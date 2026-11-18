// Screenshot the demo page per Theme and Scheme at Intensity 0, 0.5 and 1, for the quality gate's reviewer: the whole
// page at 1280 px wide, and the first screen at 1920 × 1080, 1440 × 900 and 1280 × 800, where a viewport-fixed
// backdrop sits behind the content exactly as a visitor sees it. No pixel fixtures: the images are for a person to look at.
// Usage: node scripts/screenshots.mjs <outdir> [port]   (builds first; serves the repository itself unless a port is given)
import { mkdirSync, readFileSync } from "node:fs";
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

// The display face sets figures that read as figures (07 §4): at the heading and count Slots a zero is not drawn
// as the capital O or the lowercase o, and a one not as the capital I or the lowercase l. A pair a Theme's face is
// known to fail is reported without failing the run until its own fix lands ("Theme library: `neon`'s Rajdhani zero
// reads as O and `psychedelic`'s Righteous one reads as I", localbench ticket 136). Any other pair fails, and so does
// a listed pair that no longer shows, so the set only ever shrinks.
const FIGURES_KNOWN_TO_FAIL = { neon: ["0/O"], psychedelic: ["1/I", "1/l"] };

// Returns the pairs drawn alike, as "figure/letter", and problems that stop the check itself (a face that did not
// load). A Theme whose theme.css bundles no face (`default`) sets its Slots in the body face and is not checked.
async function figureCheck(page) {
  return page.evaluate(async () => {
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
        return { alpha, left, top, width: right - left + 1, height: bottom - top + 1 };
      };
      const at = (g, x, y) => x >= 0 && y >= 0 && x < g.width && y < g.height && g.alpha[(y + g.top) * SIZE + x + g.left] > 128;
      // Two glyphs read alike when nearly every inked pixel of each has ink of the other within 2 px: a figure drawn
      // as its letter differs only in antialiasing and stroke weight, a distinct one by a flag, a width or a bowl.
      // The ink boxes are aligned at their top and at their left, then at their top and right, and the closer fit
      // counts: a one that is I's stem with a small nub at one side is then compared stem on stem, while a zero
      // narrower than its O by more than the 2 px tolerance still differs whichever side is aligned.
      const near = (g, x, y) => {
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (at(g, x + dx, y + dy)) return true;
        return false;
      };
      const apart = (a, b, ox) => {
        let differ = 0;
        let inked = 0;
        for (let y = 0; y < Math.max(a.height, b.height); y++)
          for (let x = Math.min(0, ox); x < Math.max(a.width, b.width + ox); x++) {
            const ia = at(a, x, y);
            const ib = at(b, x - ox, y);
            if (ia || ib) inked++;
            if ((ia && !near(b, x - ox, y)) || (ib && !near(a, x, y))) differ++;
          }
        return differ / inked;
      };
      const closest = (a, b) => Math.min(apart(a, b, 0), apart(a, b, a.width - b.width));
      for (const [figure, letters] of [["0", ["O", "o"]], ["1", ["I", "l"]]]) {
        const a = ink(figure);
        for (const letter of letters) if (closest(a, ink(letter)) < 0.03) alike.add(`${figure}/${letter}`);
      }
    }
    return { alike: [...alike], problems };
  });
}

// The figure check depends on neither viewport nor Intensity, so it runs once per Theme and Scheme.
function figureProblems(theme, scheme, { alike, problems }) {
  const known = FIGURES_KNOWN_TO_FAIL[theme.id] ?? [];
  const where = `${theme.id} ${scheme}`;
  for (const pair of alike) {
    const [figure, letter] = pair.split("/");
    if (known.includes(pair)) console.warn(`${where}: known: the display face draws "${figure}" like "${letter}"`);
    else problems.push(`the display face draws "${figure}" like "${letter}"`);
  }
  for (const pair of known)
    if (!alike.includes(pair)) problems.push(`${pair} is listed as known to fail but no longer does: remove it from FIGURES_KNOWN_TO_FAIL`);
  return problems;
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
            const figures = figureProblems(theme, scheme, await figureCheck(page));
            for (const p of figures) console.error(`${theme.id} ${scheme}: ${p}`);
            failed ||= figures.length > 0;
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
