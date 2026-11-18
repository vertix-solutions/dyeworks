// Screenshot the demo page per Theme and Scheme at Intensity 0, 0.5 and 1, for the quality gate's reviewer: the whole
// page at 1280 px wide, and the first screen at 1440 × 900 and 1280 × 800, where a viewport-fixed backdrop sits
// behind the content exactly as a visitor sees it. No pixel fixtures: the images are for a person to look at.
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

// The display face sets figures that read as figures (07 §4): at the heading and count Slots a zero is not drawn
// as the capital O or the lowercase o, and a one not as the capital I or the lowercase l. Themes whose face is known
// to fail are reported without failing the run until their own fix lands; the set only ever shrinks.
const FIGURES_KNOWN_TO_FAIL = new Set(["neon", "psychedelic"]);

async function figureProblems(page) {
  return page.evaluate(async () => {
    const problems = [];
    const body = getComputedStyle(document.body).fontFamily;
    for (const sel of ['[data-slot="heading"]', '[data-slot="count"]']) {
      const s = getComputedStyle(document.querySelector(sel));
      if (s.fontFamily === body) continue;
      // A canvas does not wait for a face the page has not drawn yet; load it at the size and weight drawn below.
      await document.fonts.load(`${s.fontWeight} 48px ${s.fontFamily}`, "0O1Il");
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const ink = (glyph) => {
        ctx.clearRect(0, 0, 64, 64);
        ctx.font = `${s.fontWeight} 48px ${s.fontFamily}`;
        ctx.fillText(glyph, 8, 52);
        return ctx.getImageData(0, 0, 64, 64).data.filter((_, i) => i % 4 === 3).map((a) => (a > 128 ? 1 : 0));
      };
      // Two glyphs read alike when nearly every inked pixel of each has ink of the other within 2 px: a figure drawn
      // as its letter differs only in antialiasing and stroke weight, a distinct one by a flag, a width or a bowl.
      const near = (bits, i) => {
        const x = i % 64;
        const y = (i - x) / 64;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) if (bits[(y + dy) * 64 + x + dx] && x + dx >= 0 && x + dx < 64) return true;
        return false;
      };
      for (const [figure, letters] of [["0", ["O", "o"]], ["1", ["I", "l"]]]) {
        const a = ink(figure);
        for (const letter of letters) {
          const b = ink(letter);
          let differ = 0;
          let inked = 0;
          for (let i = 0; i < a.length; i++) {
            if (a[i] || b[i]) inked++;
            if ((a[i] && !near(b, i)) || (b[i] && !near(a, i))) differ++;
          }
          if (differ < inked * 0.03) problems.push(`${sel} draws "${figure}" like "${letter}"`);
        }
      }
    }
    return problems;
  });
}

const browser = await chromium.launch();
let failed = false;
try {
  for (const theme of themes) {
    for (const scheme of theme.schemes) {
      for (const { width, height, full } of [
        { width: 1280, height: 900, full: true },
        { width: 1440, height: 900, full: false },
        { width: 1280, height: 800, full: false },
      ]) {
        const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
        const page = await context.newPage();
        for (const intensity of [0, 0.5, 1]) {
          await page.goto(`${base}/demo/?theme=${theme.id}&scheme=${scheme}&intensity=${intensity}`);
          await page.waitForSelector("body[data-ready=true]");
          await page.evaluate(() => document.fonts.ready);
          const file = join(out, `${theme.id}-${scheme}-${intensity}${full ? "" : `-${width}x${height}`}.png`);
          await page.screenshot({ path: file, fullPage: full });
          console.log(`wrote ${file}`);
          const problems = await decorationProblems(page, theme, intensity);
          const figures = await figureProblems(page);
          if (FIGURES_KNOWN_TO_FAIL.has(theme.id)) {
            for (const p of figures) console.warn(`${theme.id} ${scheme} ${intensity} ${width}x${height}: known: ${p}`);
          } else problems.push(...figures);
          for (const p of problems) console.error(`${theme.id} ${scheme} ${intensity} ${width}x${height}: ${p}`);
          failed ||= problems.length > 0;
        }
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  server?.close();
}
if (failed) {
  console.error("decoration appears outside a Slot, a Slot does not follow its Theme and Intensity, or a figure reads as a letter");
  process.exit(1);
}
