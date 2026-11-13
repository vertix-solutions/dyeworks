// The asset generation pipeline (07 §6) with the image API stubbed: the Prompt sheet, the alpha check and its
// retries, the backdrop clamp in both directions, the budgets, the names, the manifest line and provenance.
// The script itself (scripts/theme_assets.mjs) is never imported here; it only runs as a child process.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, test } from "vitest";
import {
  backdropBound,
  checkAlpha,
  clampBackdrop,
  composePrompt,
  generateAssets,
  imageFileName,
  parseSheet,
} from "../scripts/lib/assets.mjs";
import { resolveTokens } from "../scripts/lib/contrast.mjs";
import { relativeLuminance } from "../scripts/lib/color.mjs";
import { checkThemeFiles } from "../scripts/lib/provenance.mjs";
import { listFiles } from "../scripts/lib/registry.mjs";
import { trackedFiles } from "../scripts/lib/sweep.mjs";
import { contract, root } from "./helpers.mjs";

// ---------- synthetic inputs ----------

const defaultCss = readFileSync(join(root, "themes/default/theme.css"), "utf8");
// `default`'s palette under another id, with a translucent raised surface so the backdrop shows through it.
const sampleCss = (id) =>
  defaultCss.replaceAll('data-theme="default"', `data-theme="${id}"`) +
  `\nhtml[data-theme="${id}"][data-scheme="dark"] {\n  --bg-raised: rgba(255, 255, 255, 0.08);\n}\n` +
  `html[data-theme="${id}"][data-scheme="light"] {\n  --bg-raised: rgba(0, 0, 0, 0.04);\n}\n`;
const tokensFor = (scheme) => resolveTokens({ contract, css: sampleCss("sample"), id: "sample", scheme, intensity: 0.5 });

const sheetText = ({ slot, scheme, output, size, background, ship, accept }) =>
  [
    `slot: ${slot}`,
    ...(scheme ? [`scheme: ${scheme}`] : []),
    `output: ${output}`,
    `size: ${size}`,
    `background: ${background}`,
    `ship: ${ship}`,
    "",
    "## Prompt",
    `A quiet abstract ${slot} for a software interface.`,
    "",
    "## Must not",
    "Text, letters, logos,",
    "people, bright areas.",
    "",
    "## Accept",
    accept,
    "",
  ].join("\n");
const ornamentSheet = (accept = "≥ 30 % of pixels fully transparent; all four corners transparent.") =>
  sheetText({ slot: "ornament", output: "png", size: "1024x1024", background: "transparent", ship: "256x256", accept });
const backdropSheet = (scheme) =>
  sheetText({ slot: "backdrop", scheme, output: "webp", size: "1536x1024", background: "opaque", ship: "1536x1024", accept: "luminance clamp against the Tokens." });

/** An RGBA image: transparent everywhere, with an opaque square of `fill` (or noise) in the middle. */
async function iconPng({ size = 1024, square = 400, fill = [200, 40, 160], noise = false, opaqueCorner = false } = {}) {
  const data = Buffer.alloc(size * size * 4);
  const lo = (size - square) >> 1;
  let seed = 7;
  const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 16) & 255;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inside = x >= lo && x < lo + square && y >= lo && y < lo + square;
      const corner = opaqueCorner && x < size / 16 && y < size / 16;
      if (!inside && !corner) continue;
      const [r, g, b] = noise ? [rand(), rand(), rand()] : fill;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  return sharp(data, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
}

/** An opaque RGB raw image of one grey level with a small patch of another. */
function greyRaw({ width = 120, height = 80, level, patch = level, patchShare = 0 }) {
  const data = Buffer.alloc(width * height * 3, level);
  const n = Math.round(width * height * patchShare);
  for (let p = 0; p < n; p++) data.fill(patch, p * 3, p * 3 + 3);
  return { data, width, height, channels: 3 };
}
const opaquePng = async (raw) => sharp(raw.data, { raw: { width: raw.width, height: raw.height, channels: 3 } }).png().toBuffer();

const lum = (data, i) => relativeLuminance({ r: data[i], g: data[i + 1], b: data[i + 2] });
const percentile = ({ data, channels }, q) => {
  const ls = [];
  for (let i = 0; i < data.length; i += channels) ls.push(lum(data, i));
  ls.sort((a, b) => a - b);
  return ls[Math.floor(q * (ls.length - 1))];
};

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
/** A library root in a temporary directory: the real contract and one Theme with the given sheets. */
function libraryRoot({ id = "sample", schemes = ["light", "dark"], sheets = {}, files = {} }) {
  const dir = mkdtempSync(join(tmpdir(), "dyeworks-assets-"));
  dirs.push(dir);
  copyFileSync(join(root, "tokens.json"), join(dir, "tokens.json"));
  const themeDir = join(dir, "themes", id);
  mkdirSync(join(themeDir, "prompts"), { recursive: true });
  writeFileSync(join(themeDir, "theme.json"), JSON.stringify({ id, label: "Sample", schemes, intensity: true, assets: {} }, null, 2));
  writeFileSync(join(themeDir, "theme.css"), sampleCss(id));
  for (const [name, text] of Object.entries(sheets)) writeFileSync(join(themeDir, "prompts", name), text);
  for (const [name, content] of Object.entries(files)) writeFileSync(join(themeDir, name), content);
  return { dir, themeDir };
}

/** A stubbed generator: answers each request with the next image of `images` (the last one repeats). */
function stub(...images) {
  const calls = [];
  return {
    calls,
    generator: {
      name: "stub-images",
      model: "stub-1",
      async generate(request) {
        calls.push(request);
        return images[Math.min(calls.length - 1, images.length - 1)];
      },
    },
  };
}
const now = () => new Date("2026-11-13T09:00:00Z");
const run = async (dir, generator, opts = {}) => {
  const lines = [];
  const result = await generateAssets({ root: dir, generator, now, log: (l) => lines.push(l), ...opts });
  return { ...result, lines };
};
const sha = (b) => createHash("sha256").update(b).digest("hex");

// ---------- the Prompt sheet ----------

describe("a Prompt sheet", () => {
  test("parses its header, its sections and its alpha threshold", () => {
    const s = parseSheet(ornamentSheet(), "ornament.md");
    expect(s).toMatchObject({ slot: "ornament", scheme: null, output: "png", size: "1024x1024", background: "transparent", ship: { width: 256, height: 256 }, threshold: 0.3 });
    expect(s.prompt).toBe("A quiet abstract ornament for a software interface.");
    expect(s.mustNot).toBe("Text, letters, logos, people, bright areas.");
  });

  test("carries its Scheme when it names one", () => {
    expect(parseSheet(backdropSheet("dark"), "backdrop.dark.md")).toMatchObject({ slot: "backdrop", scheme: "dark", threshold: null });
  });

  test("appends its Must not list to the prompt as one sentence", () => {
    expect(composePrompt(parseSheet(ornamentSheet(), "ornament.md"))).toBe(
      "A quiet abstract ornament for a software interface. It must not contain any of: text, letters, logos, people, bright areas.",
    );
  });

  test.each([
    ["a file name that is not its Slot and Scheme", ornamentSheet(), "ornament.dark.md", /named ornament\.md/],
    ["an unknown Slot", ornamentSheet().replace("slot: ornament", "slot: gauge"), "gauge.md", /not a Slot/],
    ["an output the Slot does not ship", ornamentSheet().replace("output: png", "output: webp"), "ornament.md", /ships as png/],
    ["a transparent sheet without a threshold", ornamentSheet("all four corners transparent."), "ornament.md", /threshold/],
    ["a missing header field", ornamentSheet().replace("ship: 256x256\n", ""), "ornament.md", /ship/],
    ["a missing Prompt section", ornamentSheet().replace("## Prompt", "## Brief"), "ornament.md", /## Prompt/],
  ])("with %s is refused", (_name, text, file, message) => {
    expect(() => parseSheet(text, file)).toThrow(message);
  });

  test("names its image after its Slot and Scheme", () => {
    expect(imageFileName(parseSheet(backdropSheet("dark"), "backdrop.dark.md"))).toBe("backdrop.dark.webp");
    expect(imageFileName(parseSheet(backdropSheet(), "backdrop.md"))).toBe("backdrop.webp");
    expect(imageFileName(parseSheet(ornamentSheet(), "ornament.md"))).toBe("ornament.png");
  });
});

// ---------- the alpha check ----------

describe("the alpha check", () => {
  const rgba = async (png) => {
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, channels: 4 };
  };

  test("passes a transparent image with every corner transparent", async () => {
    expect(checkAlpha(await rgba(await iconPng()), 0.3)).toMatchObject({ ok: true });
  });

  test("fails an image with an opaque corner", async () => {
    const result = checkAlpha(await rgba(await iconPng({ opaqueCorner: true })), 0.3);
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/corner/);
  });

  test("fails an image under the sheet's transparent share", async () => {
    const result = checkAlpha(await rgba(await iconPng({ square: 900 })), 0.3);
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/transparent/);
  });
});

// ---------- the clamp ----------

describe("the backdrop clamp", () => {
  test("bounds a dark Scheme's brightest pixel and a light Scheme's darkest, from the Tokens", () => {
    const dark = backdropBound(tokensFor("dark"), "dark", contract);
    const light = backdropBound(tokensFor("light"), "light", contract);
    expect(dark.direction).toBe("darken");
    expect(light.direction).toBe("lighten");
    expect(dark.limit).toBeGreaterThan(0);
    expect(dark.limit).toBeLessThan(light.limit);
    expect(light.limit).toBeLessThan(1);
  });

  test("an opaque raised surface leaves the image unbounded", () => {
    const opaque = resolveTokens({ contract, css: defaultCss, id: "default", scheme: "dark", intensity: 0.5 });
    expect(backdropBound(opaque, "dark", contract).limit).toBe(1);
  });

  test("darkens a bright image under the dark Scheme's bound", () => {
    const bound = backdropBound(tokensFor("dark"), "dark", contract);
    const raw = greyRaw({ level: 30, patch: 240, patchShare: 0.05 });
    expect(percentile(raw, 0.999)).toBeGreaterThan(bound.limit);
    const out = clampBackdrop(raw, [bound]);
    expect(out.changed).toBe(true);
    expect(percentile(out, 0.999)).toBeLessThanOrEqual(bound.limit);
  });

  test("lightens a dark image above the light Scheme's bound", () => {
    const bound = backdropBound(tokensFor("light"), "light", contract);
    const raw = greyRaw({ level: 235, patch: 20, patchShare: 0.05 });
    expect(percentile(raw, 0.001)).toBeLessThan(bound.limit);
    const out = clampBackdrop(raw, [bound]);
    expect(out.changed).toBe(true);
    expect(percentile(out, 0.001)).toBeGreaterThanOrEqual(bound.limit);
  });

  test("leaves a compliant image unchanged", () => {
    const bound = backdropBound(tokensFor("dark"), "dark", contract);
    const raw = greyRaw({ level: 18 });
    const out = clampBackdrop(raw, [bound]);
    expect(out.changed).toBe(false);
    expect(out.data.equals(raw.data)).toBe(true);
  });

  test("is deterministic", () => {
    const bound = backdropBound(tokensFor("dark"), "dark", contract);
    const raw = greyRaw({ level: 90, patch: 250, patchShare: 0.2 });
    expect(clampBackdrop(raw, [bound]).data.equals(clampBackdrop(raw, [bound]).data)).toBe(true);
  });
});

// ---------- the pipeline, with the API stubbed ----------

describe("generating a Theme's assets", () => {
  test("writes a transparent Slot's PNG beside its fallback, prints the manifest line and records provenance", async () => {
    const sheet = ornamentSheet();
    const { dir, themeDir } = libraryRoot({ sheets: { "ornament.md": sheet }, files: { "ornament.svg": "<svg/>" } });
    const { generator, calls } = stub(await iconPng());
    const { failures, lines } = await run(dir, generator);

    expect(failures).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ prompt: composePrompt(parseSheet(sheet, "ornament.md")), size: "1024x1024", background: "transparent" });
    const png = readFileSync(join(themeDir, "ornament.png"));
    const meta = await sharp(png).metadata();
    expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(["png", 256, 256, true]);
    expect(meta.exif ?? meta.icc ?? meta.xmp).toBeUndefined();
    expect(lines).toContain('themes/sample/theme.json, assets.ornament: "image": "ornament.png"');

    const provenance = JSON.parse(readFileSync(join(themeDir, "provenance.json"), "utf8"));
    expect(provenance).toEqual({
      format: "dyeworks-provenance/1",
      images: [{ file: "ornament.png", generator: "stub-images", model: "stub-1", generated_at: "2026-11-13", prompt_sha256: sha(sheet), sha256: sha(png), bytes: png.length }],
    });
    expect(checkThemeFiles(themeDir)).toEqual([]);
  });

  test("retries a sheet whose image fails the alpha check three times, then fails naming the sheet", async () => {
    const { dir, themeDir } = libraryRoot({ sheets: { "ornament.md": ornamentSheet() } });
    const { generator, calls } = stub(await iconPng({ opaqueCorner: true }));
    const { failures } = await run(dir, generator);

    expect(calls).toHaveLength(4);
    expect(failures).toEqual([expect.stringContaining("themes/sample/prompts/ornament.md")]);
    expect(failures[0]).toMatch(/alpha check/);
    expect(existsSync(join(themeDir, "ornament.png"))).toBe(false);
    expect(existsSync(join(themeDir, "provenance.json"))).toBe(false);
  });

  test("accepts a retry that passes", async () => {
    const { dir, themeDir } = libraryRoot({ sheets: { "ornament.md": ornamentSheet() } });
    const { generator, calls } = stub(await iconPng({ opaqueCorner: true }), await iconPng());
    expect((await run(dir, generator)).failures).toEqual([]);
    expect(calls).toHaveLength(2);
    expect(existsSync(join(themeDir, "ornament.png"))).toBe(true);
  });

  test("fails an image over its budget after compression and writes nothing", async () => {
    const { dir, themeDir } = libraryRoot({ sheets: { "ornament.md": ornamentSheet() } });
    const { generator } = stub(await iconPng({ size: 256, square: 180, noise: true }));
    const { failures } = await run(dir, generator);

    expect(failures).toEqual([expect.stringMatching(/themes\/sample\/prompts\/ornament\.md.*over its budget of 40000 bytes/)]);
    expect(listFiles(themeDir).sort()).toEqual(["prompts/ornament.md", "theme.css", "theme.json"]);
  });

  test("names a per-Scheme image after its Scheme and clamps it in that Scheme's direction", async () => {
    const { dir, themeDir } = libraryRoot({ sheets: { "backdrop.dark.md": backdropSheet("dark"), "backdrop.light.md": backdropSheet("light") } });
    const bright = await opaquePng(greyRaw({ width: 1536, height: 1024, level: 120, patch: 250, patchShare: 0.1 }));
    const { generator } = stub(bright);
    const { failures, lines } = await run(dir, generator);

    expect(failures).toEqual([]);
    expect(listFiles(themeDir).filter((f) => f.endsWith(".webp")).sort()).toEqual(["backdrop.dark.webp", "backdrop.light.webp"]);
    expect(lines).toContain('themes/sample/theme.json, assets.backdrop.dark: "image": "backdrop.dark.webp"');
    expect(lines).toContain('themes/sample/theme.json, assets.backdrop.light: "image": "backdrop.light.webp"');
    const raw = async (f) => {
      const { data, info } = await sharp(join(themeDir, f)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([1536, 1024]);
      return { data, channels: 3 };
    };
    // the clamp ran on the raw pixels; WebP at quality 80 may move a pixel by a step, never by the clamp's margin
    expect(percentile(await raw("backdrop.dark.webp"), 0.999)).toBeLessThan(percentile(await raw("backdrop.light.webp"), 0.001));
    expect(percentile(await raw("backdrop.dark.webp"), 0.999)).toBeLessThanOrEqual(backdropBound(tokensFor("dark"), "dark", contract).limit * 1.1);
    const provenance = JSON.parse(readFileSync(join(themeDir, "provenance.json"), "utf8"));
    expect(provenance.images.map((e) => e.file).sort()).toEqual(["backdrop.dark.webp", "backdrop.light.webp"]);
    expect(checkThemeFiles(themeDir)).toEqual([]);
  });

  test("fails a shared backdrop on a two-Scheme Theme that cannot meet both bounds", async () => {
    const { dir } = libraryRoot({ sheets: { "backdrop.md": backdropSheet() } });
    const { generator } = stub(await opaquePng(greyRaw({ width: 1536, height: 1024, level: 128 })));
    const { failures } = await run(dir, generator);
    expect(failures).toEqual([expect.stringMatching(/themes\/sample\/prompts\/backdrop\.md.*both Schemes/)]);
  });

  test("clamps a shared backdrop on a dark-only Theme against the dark bound and names it bare", async () => {
    const { dir, themeDir } = libraryRoot({ schemes: ["dark"], sheets: { "backdrop.md": backdropSheet() } });
    const { generator } = stub(await opaquePng(greyRaw({ width: 1536, height: 1024, level: 200 })));
    expect((await run(dir, generator)).failures).toEqual([]);
    expect(existsSync(join(themeDir, "backdrop.webp"))).toBe(true);
  });

  test("refuses a sheet for a Scheme the Theme does not declare", async () => {
    const { dir } = libraryRoot({ schemes: ["dark"], sheets: { "backdrop.light.md": backdropSheet("light") } });
    const { generator, calls } = stub(await opaquePng(greyRaw({ width: 1536, height: 1024, level: 10 })));
    const { failures } = await run(dir, generator);
    expect(calls).toHaveLength(0);
    expect(failures).toEqual([expect.stringMatching(/backdrop\.light\.md.*undeclared Scheme "light"/)]);
  });

  test("skips an asset whose image is already shipped unless forced, and replaces its provenance entry", async () => {
    const { dir, themeDir } = libraryRoot({ sheets: { "ornament.md": ornamentSheet() } });
    const first = stub(await iconPng());
    await run(dir, first.generator);
    const again = stub(await iconPng({ fill: [20, 200, 220] }));
    await run(dir, again.generator);
    expect(again.calls).toHaveLength(0);

    await run(dir, again.generator, { force: true });
    expect(again.calls).toHaveLength(1);
    const provenance = JSON.parse(readFileSync(join(themeDir, "provenance.json"), "utf8"));
    expect(provenance.images).toHaveLength(1);
    expect(provenance.images[0].sha256).toBe(sha(readFileSync(join(themeDir, "ornament.png"))));
  });

  test("keeps other images' provenance entries", async () => {
    const other = { file: "empty.png", generator: "g", model: "m", generated_at: "2026-11-01", prompt_sha256: "a", sha256: "b", bytes: 1 };
    const { dir, themeDir } = libraryRoot({
      sheets: { "ornament.md": ornamentSheet() },
      files: { "provenance.json": JSON.stringify({ format: "dyeworks-provenance/1", images: [other] }) },
    });
    await run(dir, stub(await iconPng()).generator);
    const provenance = JSON.parse(readFileSync(join(themeDir, "provenance.json"), "utf8"));
    expect(provenance.images.map((e) => e.file)).toEqual(["empty.png", "ornament.png"]);
  });

  test("narrows to one Theme and one Slot", async () => {
    const { dir } = libraryRoot({ sheets: { "ornament.md": ornamentSheet(), "backdrop.dark.md": backdropSheet("dark") } });
    const { generator, calls } = stub(await iconPng());
    await run(dir, generator, { slot: "ornament" });
    expect(calls).toHaveLength(1);
    expect(calls[0].background).toBe("transparent");
    const none = stub(await iconPng());
    await expect(run(dir, none.generator, { theme: "other", force: true })).rejects.toThrow(/no Theme "other"/);
    expect(none.calls).toHaveLength(0);
  });

  test("reports an API failure for the sheet and goes on with the next", async () => {
    const { dir, themeDir } = libraryRoot({ sheets: { "backdrop.dark.md": backdropSheet("dark"), "ornament.md": ornamentSheet() } });
    const icon = await iconPng();
    const generator = {
      name: "stub-images",
      model: "stub-1",
      generate: async (req) => {
        if (req.background === "opaque") throw new Error("the API answered 500");
        return icon;
      },
    };
    const { failures } = await run(dir, generator);
    expect(failures).toEqual([expect.stringMatching(/backdrop\.dark\.md.*the API answered 500/)]);
    expect(existsSync(join(themeDir, "ornament.png"))).toBe(true);
  });
});

// ---------- the script as a consumer of the environment ----------

describe("scripts/theme_assets.mjs", () => {
  const script = join(root, "scripts", "theme_assets.mjs");
  const keyName = ["OPENAI", "API", "KEY"].join("_");
  const snapshot = () =>
    listFiles(join(root, "themes"))
      .sort()
      .map((f) => `${f} ${sha(readFileSync(join(root, "themes", f)))}`);

  test("without the key exits non-zero with exactly one line and changes nothing", () => {
    const before = snapshot();
    const env = { ...process.env };
    delete env[keyName];
    const out = spawnSync(process.execPath, [script, "--force"], { cwd: root, env, encoding: "utf8" });
    expect(out.status).not.toBe(0);
    const lines = (out.stdout + out.stderr).split("\n").filter((l) => l !== "");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(new RegExp(keyName));
    expect(snapshot()).toEqual(before);
  });

  // The provenance format records the generator by name (07 §6), so its fixtures may; the code, the demo
  // page and the docs may not.
  test("is imported by nothing, and is the only code or doc that names the image API", () => {
    const paths = trackedFiles(root);
    if (paths === null) return;
    const vendor = ["open", "ai"].join("");
    const self = "scripts/theme_assets.mjs";
    const texts = paths
      .filter((p) => p !== self && /\.(mjs|js|ts|tsx|html|md)$/.test(p) && existsSync(join(root, p)))
      .map((p) => [p, readFileSync(join(root, p), "utf8")]);
    expect(texts.filter(([, t]) => /\bimport\s*(?:\(\s*|[^;]*?\bfrom\s*)["'][^"']*theme_assets/.test(t)).map(([p]) => p)).toEqual([]);
    const outsideTests = texts.filter(([p]) => !p.startsWith("test/"));
    expect(outsideTests.filter(([, t]) => t.toLowerCase().includes(vendor)).map(([p]) => p)).toEqual([]);
  });
});
