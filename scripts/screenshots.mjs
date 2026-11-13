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

// Under a Theme declaring intensity: false every decoration Slot must be inert.
async function inertProblems(page) {
  return page.evaluate(() => {
    const problems = [];
    const style = (sel, pseudo) => getComputedStyle(document.querySelector(sel), pseudo);
    const action = style('[data-slot="primary_action"]');
    if (action.boxShadow !== "none") problems.push(`primary_action box-shadow ${action.boxShadow}`);
    if (action.backgroundImage !== "none") problems.push(`primary_action background-image ${action.backgroundImage}`);
    const underline = style('.card [data-slot="active_navigation"]', "::after");
    if (underline.boxShadow !== "none") problems.push(`active_navigation glow ${underline.boxShadow}`);
    const mark = style('[data-slot="selected_mark"][data-selected="true"]');
    if (mark.filter !== "none") problems.push(`selected_mark filter ${mark.filter}`);
    for (const sel of ['[data-slot="backdrop"]', '[data-slot="ornament"]', '[data-slot="empty_illustration"]']) {
      const s = style(sel);
      if (s.backgroundImage !== "none") problems.push(`${sel} background-image ${s.backgroundImage}`);
    }
    for (const sel of ['[data-slot="heading"]', '[data-slot="wordmark"]', '[data-slot="count"]']) {
      if (style(sel).fontFamily !== getComputedStyle(document.body).fontFamily) problems.push(`${sel} is not in the body face`);
    }
    return problems;
  });
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
        if (!theme.intensity) {
          const problems = await inertProblems(page);
          for (const p of problems) console.error(`${theme.id} ${scheme} ${intensity}: ${p}`);
          failed ||= problems.length > 0;
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server?.close();
}
if (failed) {
  console.error("a decoration Slot is not inert under a Theme declaring intensity: false");
  process.exit(1);
}
