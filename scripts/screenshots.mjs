// Screenshot the demo page per Theme and Scheme at Intensity 0, 0.5 and 1, for the quality gate's reviewer.
// No pixel fixtures: the images are for a person to look at.
// Usage: node scripts/screenshots.mjs <outdir> [port]   (builds first; serves the repository itself unless a port is given)
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { build } from "./build.mjs";
import { serve } from "./serve.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] ?? "screenshots";
const givenPort = process.argv[3];
mkdirSync(out, { recursive: true });
build(root);
const { themes } = await import(pathToFileURL(join(root, "dist", "registry.js")).href);
const server = givenPort ? null : await serve(root, 0);
const base = `http://127.0.0.1:${givenPort ?? server.address().port}`;

// Decoration appears only at the Slots (07 §5). Under a Theme declaring intensity: false every Slot is inert;
// under one declaring true, Intensity 0 is the flat look and above it every decorating Slot shows.
async function decorationProblems(page, theme, intensity) {
  return page.evaluate(({ responds, intensity }) => {
    const problems = [];
    const style = (sel, pseudo) => getComputedStyle(document.querySelector(sel), pseudo);
    const lengths = (v) => [...v.matchAll(/(-?[\d.]+)px/g)].map((m) => Number(m[1]));
    const alphaZero = (v) => /rgba\([^)]*,\s*0\)/.test(v) || /\/\s*0\)/.test(v) || v.includes("transparent");
    const invisibleShadow = (v) => v === "none" || alphaZero(v) || lengths(v).every((n) => n === 0);
    const display = style('[data-slot="heading"]').fontFamily;
    const body = getComputedStyle(document.body).fontFamily;

    // Nothing outside a Slot is decorated: no glow, no filter, no image, no display face.
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("[data-slot]") || el.closest("svg") || ["OPTION", "SCRIPT"].includes(el.tagName)) continue;
      const s = getComputedStyle(el);
      const name = el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`;
      if (s.boxShadow !== "none") problems.push(`${name} has box-shadow ${s.boxShadow}`);
      if (s.filter !== "none") problems.push(`${name} has filter ${s.filter}`);
      if (s.backgroundImage !== "none") problems.push(`${name} has background-image ${s.backgroundImage}`);
      if (display !== body && s.fontFamily === display) problems.push(`${name} wears the display face`);
    }
    for (const el of document.querySelectorAll('[data-slot="selected_mark"]:not([data-selected="true"])'))
      if (getComputedStyle(el).filter !== "none") problems.push("an unselected mark has a filter");

    const action = style('[data-slot="primary_action"]');
    const underline = style('.card [data-slot="active_navigation"]', "::after");
    const mark = style('[data-slot="selected_mark"][data-selected="true"]');
    const images = ['[data-slot="backdrop"]', '[data-slot="ornament"]', '[data-slot="empty_illustration"]'];
    if (!responds) {
      if (action.boxShadow !== "none") problems.push(`primary_action box-shadow ${action.boxShadow}`);
      if (action.backgroundImage !== "none") problems.push(`primary_action background-image ${action.backgroundImage}`);
      if (underline.boxShadow !== "none") problems.push(`active_navigation glow ${underline.boxShadow}`);
      if (mark.filter !== "none") problems.push(`selected_mark filter ${mark.filter}`);
      for (const sel of images) if (style(sel).backgroundImage !== "none") problems.push(`${sel} background-image ${style(sel).backgroundImage}`);
      for (const sel of ['[data-slot="heading"]', '[data-slot="wordmark"]', '[data-slot="count"]'])
        if (style(sel).fontFamily !== body) problems.push(`${sel} is not in the body face`);
      return problems;
    }
    for (const sel of ['[data-slot="wordmark"]', '[data-slot="count"]'])
      if (style(sel).fontFamily !== display) problems.push(`${sel} is not in the display face`);
    if (style('[data-slot="empty_illustration"]').backgroundImage === "none") problems.push("empty_illustration has no image");
    if (action.backgroundImage === "none") problems.push("primary_action has no gradient");
    if (underline.backgroundImage === "none") problems.push("active_navigation's underline has no gradient");
    const assetOpacity = Number(style('[data-slot="backdrop"]').opacity);
    if (intensity === 0) {
      if (!invisibleShadow(action.boxShadow)) problems.push(`at 0, primary_action glows: ${action.boxShadow}`);
      if (!invisibleShadow(underline.boxShadow)) problems.push(`at 0, active_navigation glows: ${underline.boxShadow}`);
      if (mark.filter !== "none" && !invisibleShadow(mark.filter)) problems.push(`at 0, selected_mark glows: ${mark.filter}`);
      if (assetOpacity !== 0) problems.push(`at 0, the backdrop shows at ${assetOpacity}`);
    } else {
      if (invisibleShadow(action.boxShadow)) problems.push("primary_action has no glow");
      if (invisibleShadow(underline.boxShadow)) problems.push("active_navigation has no glow");
      if (invisibleShadow(mark.filter)) problems.push("selected_mark has no glow");
      if (assetOpacity === 0) problems.push("the backdrop is hidden");
      for (const sel of images) if (style(sel).backgroundImage === "none") problems.push(`${sel} has no image`);
    }
    return problems;
  }, { responds: theme.intensity, intensity });
}

const browser = await chromium.launch();
let failed = false;
try {
  for (const theme of themes) {
    for (const scheme of theme.schemes) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
      const page = await context.newPage();
      for (const intensity of [0, 0.5, 1]) {
        await page.goto(`${base}/demo/?theme=${theme.id}&scheme=${scheme}&intensity=${intensity}`);
        await page.waitForSelector("body[data-ready=true]");
        await page.evaluate(() => document.fonts.ready);
        const file = join(out, `${theme.id}-${scheme}-${intensity}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`wrote ${file}`);
        const problems = await decorationProblems(page, theme, intensity);
        for (const p of problems) console.error(`${theme.id} ${scheme} ${intensity}: ${p}`);
        failed ||= problems.length > 0;
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server?.close();
}
if (failed) {
  console.error("decoration appears outside a Slot, or a Slot does not follow its Theme and Intensity");
  process.exit(1);
}
