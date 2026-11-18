// The palette step of the asset pipeline (07 §6) is checked on the file that ships: quantisation is lossy, so a
// transparent Slot's palette PNG is decoded and its alpha checked again before it is written. libvips keeps a
// fully transparent pixel at alpha 0 through quantisation, so here sharp's palette encoder is wrapped to return a
// PNG whose top-left corner lost its transparency, standing in for a quantiser that does not.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { generateAssets } from "../scripts/lib/assets.mjs";
import { listFiles } from "../scripts/lib/registry.mjs";
import { root } from "./helpers.mjs";

const palettes = { made: 0 };

vi.mock("sharp", async (importOriginal) => {
  const real = (await importOriginal()).default;
  const wrapped = (...args) => {
    const image = real(...args);
    const png = image.png.bind(image);
    image.png = (options) => {
      if (!options?.palette) return png(options);
      return {
        async toBuffer() {
          palettes.made++;
          const { data, info } = await real(await png(options).toBuffer()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          data.fill(255, 0, 4); // the top-left pixel, opaque white
          return real(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ palette: true }).toBuffer();
        },
      };
    };
    return image;
  };
  return { default: wrapped };
});

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const ornamentSheet = [
  "slot: ornament",
  "output: png",
  "size: 1024x1024",
  "background: transparent",
  "ship: 256x256",
  "",
  "## Prompt",
  "A quiet abstract ornament for a software interface.",
  "",
  "## Must not",
  "Text, letters, logos.",
  "",
  "## Accept",
  "≥ 30 % of pixels fully transparent; all four corners transparent.",
  "",
].join("\n");

/** An icon whose lossless PNG is over the ornament budget, so the pipeline takes the palette step. */
async function gradientIcon() {
  const { default: sharp } = await import("sharp");
  const size = 256;
  const data = Buffer.alloc(size * size * 4);
  let seed = 7;
  const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 16) & 7;
  for (let y = 28; y < 228; y++)
    for (let x = 28; x < 228; x++) {
      const i = (y * size + x) * 4;
      data[i] = Math.min(255, x + rand());
      data[i + 1] = Math.min(255, y + rand());
      data[i + 2] = 128 + rand();
      data[i + 3] = 255;
    }
  return sharp(data, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}

test("retries a transparent Slot whose palette PNG fails the alpha check, then fails naming the sheet and writes nothing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dyeworks-palette-"));
  dirs.push(dir);
  copyFileSync(join(root, "tokens.json"), join(dir, "tokens.json"));
  const themeDir = join(dir, "themes", "sample");
  mkdirSync(join(themeDir, "prompts"), { recursive: true });
  writeFileSync(join(themeDir, "theme.json"), JSON.stringify({ id: "sample", label: "Sample", schemes: ["light", "dark"], intensity: true, assets: {} }, null, 2));
  const css = readFileSync(join(root, "themes/default/theme.css"), "utf8").replaceAll('data-theme="default"', 'data-theme="sample"');
  writeFileSync(join(themeDir, "theme.css"), css);
  writeFileSync(join(themeDir, "prompts", "ornament.md"), ornamentSheet);

  const icon = await gradientIcon();
  let calls = 0;
  const generator = { name: "stub-images", model: "stub-1", generate: async () => (calls++, icon) };
  const { written, failures } = await generateAssets({ root: dir, generator });

  expect(palettes.made).toBe(4);
  expect(calls).toBe(4);
  expect(written).toEqual([]);
  expect(failures).toEqual([
    expect.stringMatching(/themes\/sample\/prompts\/ornament\.md: the alpha check failed on the palette PNG \(1 corner not transparent\) after 4 attempts/),
  ]);
  expect(listFiles(themeDir).sort()).toEqual(["prompts/ornament.md", "theme.css", "theme.json"]);
});
