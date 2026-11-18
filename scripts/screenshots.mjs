// Screenshot the demo page per Theme and Scheme at Intensity 0, 0.5 and 1, for the quality gate's reviewer: the whole
// page at 1280 px wide, and the first screen at 1920 × 1080, 1440 × 900 and 1280 × 800, where a viewport-fixed
// backdrop sits behind the content exactly as a visitor sees it. No pixel fixtures: the images are for a person to look at.
// Usage: node scripts/screenshots.mjs <outdir> [port]   (builds first; serves the repository itself unless a port is given)
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { build } from "./build.mjs";
import { ALIKE_BELOW, figureProblems, glyphsApart } from "./lib/figures.mjs";
import { serve } from "./serve.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] ?? "screenshots";
const givenPort = process.argv[3];
mkdirSync(out, { recursive: true });
build(root);
const { themes } = await import(pathToFileURL(join(root, "dist", "registry.js")).href);
const server = givenPort ? null : await serve(root, 0);
const base = `http://127.0.0.1:${givenPort ?? server.address().port}`;

// The whole page at 1280 px wide, then the first screen at three common desktop sizes.
const SHOTS = [
  { width: 1280, height: 900, full: true },
  { width: 1920, height: 1080, full: false },
  { width: 1440, height: 900, full: false },
  { width: 1280, height: 800, full: false },
];

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

// The display face sets figures that read as figures (07 §4); `scripts/lib/figures.mjs` judges the result and
// holds the pairs a face is known to fail. The page draws the glyphs and measures them with that module's
// `glyphsApart`, handed over as source.
// Returns the pairs drawn alike, as "figure/letter", and problems that stop the check itself (a face that did not
// load). A Theme whose theme.css bundles no face (`default`) sets its Slots in the body face and is not checked.
async function figureCheck(page) {
  return page.evaluate(async ({ apartSource, alikeBelow }) => {
    const glyphsApart = new Function(`return (${apartSource})`)();
    const alike = new Set();
    const problems = [];
    const SIZE = 128;
    const fonts = new Set();
    for (const sel of ['[data-slot="heading"]', '[data-slot="count"]']) {
      const s = getComputedStyle(document.querySelector(sel));
      fonts.add(`${s.fontWeight} 48px ${s.fontFamily}`);
    }
    for (const font of fonts) {
      // A canvas does not wait for a face the page has not drawn yet; load it at the size and weight drawn below.
      // A face that fails may reject the load or resolve it with the system fallback drawn in its place, so ask
      // afterwards whether the first family in the list is usable before trusting the canvas.
      const first = /\d+ 48px\s+("[^"]+"|'[^']+'|[^,]+)/.exec(font)[1].trim();
      const loaded = await document.fonts.load(font, "0O1Il").then(() => true, () => false);
      if (!loaded || !document.fonts.check(font.replace(/48px\s+.*/, `48px ${first}`), "0O1Il")) {
        problems.push(`the face ${first} did not load, so its figures were not checked`);
        continue;
      }
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      // Each glyph's ink, cropped to its bounding box, so two glyphs are compared shape on shape whatever their side
      // bearings: a one that is the same stem as I set with a different advance still counts as alike.
      const ink = (glyph) => {
        ctx.clearRect(0, 0, SIZE, SIZE);
        ctx.font = font;
        ctx.fillText(glyph, 32, 96);
        const alpha = ctx.getImageData(0, 0, SIZE, SIZE).data.filter((_, i) => i % 4 === 3);
        let left = SIZE, top = SIZE, right = -1, bottom = -1;
        for (let i = 0; i < alpha.length; i++) {
          if (alpha[i] <= 128) continue;
          const x = i % SIZE;
          const y = (i - x) / SIZE;
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        return { alpha, size: SIZE, left, top, width: right - left + 1, height: bottom - top + 1 };
      };
      // Two glyphs read alike when nearly every inked pixel of each has ink of the other within 2 px: a figure drawn
      // as its letter differs only in antialiasing and stroke weight, a distinct one by a flag, a width or a bowl.
      // The ink boxes are aligned at their top and at their left, then at their top and right, and the closer fit
      // counts: a one that is I's stem with a small nub at one side is then compared stem on stem, while a zero
      // narrower than its O by more than the 2 px tolerance still differs whichever side is aligned.
      const closest = (a, b) => Math.min(glyphsApart(a, b, 0), glyphsApart(a, b, a.width - b.width));
      for (const [figure, letters] of [["0", ["O", "o"]], ["1", ["I", "l"]]]) {
        const a = ink(figure);
        for (const letter of letters) if (closest(a, ink(letter)) < alikeBelow) alike.add(`${figure}/${letter}`);
      }
    }
    return { alike: [...alike], problems };
  }, { apartSource: glyphsApart.toString(), alikeBelow: ALIKE_BELOW });
}

const browser = await chromium.launch();
let failed = false;
try {
  for (const theme of themes) {
    const bundlesFace = readFileSync(join(root, "themes", theme.id, "theme.css"), "utf8").includes("@font-face");
    for (const scheme of theme.schemes) {
      for (const { width, height, full } of SHOTS) {
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
          for (const p of problems) console.error(`${theme.id} ${scheme} ${intensity} ${width}x${height}: ${p}`);
          failed ||= problems.length > 0;
          if (full && intensity === 0 && bundlesFace) {
            // The figure check depends on neither viewport nor Intensity, so it runs once per Theme and Scheme.
            const figures = figureProblems(theme.id, await figureCheck(page));
            for (const n of figures.notes) console.warn(`${theme.id} ${scheme}: ${n}`);
            for (const p of figures.problems) console.error(`${theme.id} ${scheme}: ${p}`);
            failed ||= figures.problems.length > 0;
          }
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
