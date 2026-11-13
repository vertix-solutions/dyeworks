// The asset pipeline of 07 §6 behind one injected generator: read every Prompt sheet, ask the generator for
// each missing image, post-process with sharp, check alpha or clamp luminance, enforce the budget, write the
// image beside its fallback and record its provenance. The image API is named only in scripts/theme_assets.mjs.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { contrastRatio, flatten, parseColor, relativeLuminance } from "./color.mjs";
import { resolveTokens } from "./contrast.mjs";
import { loadThemes } from "./registry.mjs";

/** Each Slot's row of the formats table (07 §6): what it ships as and its budget in bytes. */
export const SLOT_TABLE = {
  backdrop: { output: "webp", background: "opaque", budget: 400_000 },
  ornament: { output: "png", background: "transparent", budget: 40_000 },
  empty: { output: "png", background: "transparent", budget: 200_000 },
};
const SCHEMES = ["light", "dark"];
const HEADER_FIELDS = ["slot", "output", "size", "background", "ship"];
/** One attempt and up to three retries of the same sheet when the alpha check fails. */
export const ALPHA_RETRIES = 3;
const AA = 4.5;
const WEBP_QUALITY = 80;
/** The share of pixels the clamp may leave beyond its bound: the brightest (or darkest) 0.1 %. */
const TAIL = 0.001;
const PROVENANCE_FORMAT = "dyeworks-provenance/1";

const dims = (text, field) => {
  const m = /^(\d+)\s*x\s*(\d+)$/.exec(text);
  if (!m) throw new Error(`${field} "${text}" is not <width>x<height>`);
  return { width: Number(m[1]), height: Number(m[2]) };
};

/**
 * Parse a Prompt sheet: the header, `## Prompt`, `## Must not`, `## Accept`, and the alpha threshold
 * a transparent sheet's Accept line names (`≥ 30 % of pixels fully transparent`).
 * @param {string} text
 * @param {string} fileName the sheet's file name, which must be `<slot>[.<scheme>].md`
 */
export function parseSheet(text, fileName) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const header = {};
  let i = 0;
  for (; i < lines.length && !lines[i].startsWith("## "); i++) {
    const line = lines[i].trim();
    if (line === "") continue;
    const m = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!m) throw new Error(`the header line "${line}" is not <field>: <value>`);
    header[m[1]] = m[2].trim();
  }
  const sections = {};
  let current = null;
  for (; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) sections[(current = lines[i].slice(3).trim())] = [];
    else if (current) sections[current].push(lines[i]);
  }
  const prose = (name) => {
    if (!(name in sections)) throw new Error(`the sheet has no "## ${name}" section`);
    const t = sections[name].map((l) => l.trim().replace(/^[-*]\s+/, "")).filter(Boolean).join(" ").trim();
    if (!t) throw new Error(`the sheet's "## ${name}" section is empty`);
    return t;
  };

  for (const f of HEADER_FIELDS) if (!header[f]) throw new Error(`the header has no ${f}`);
  const slot = header.slot;
  const row = SLOT_TABLE[slot];
  if (!row) throw new Error(`"${slot}" is not a Slot with an image (${Object.keys(SLOT_TABLE).join(", ")})`);
  const scheme = header.scheme ?? null;
  if (scheme !== null && !SCHEMES.includes(scheme)) throw new Error(`scheme "${scheme}" is not a Scheme (light, dark)`);
  const expected = `${slot}${scheme ? `.${scheme}` : ""}.md`;
  if (fileName !== expected) throw new Error(`a sheet for ${slot}${scheme ? ` on ${scheme}` : ""} is named ${expected}, not ${fileName}`);
  if (header.output !== row.output) throw new Error(`${slot} ships as ${row.output}, not ${header.output}`);
  if (header.background !== row.background) throw new Error(`${slot} is requested ${row.background}, not ${header.background}`);
  dims(header.size, "size");
  const ship = dims(header.ship, "ship");

  const accept = prose("Accept");
  let threshold = null;
  if (row.background === "transparent") {
    const m = /(?:≥|>=)\s*(\d+(?:\.\d+)?)\s*%/.exec(accept);
    if (!m) throw new Error(`a transparent sheet's Accept line names its threshold (≥ <n> % of pixels fully transparent)`);
    threshold = Number(m[1]) / 100;
  }
  return {
    slot,
    scheme,
    output: header.output,
    size: header.size,
    background: header.background,
    ship,
    prompt: prose("Prompt"),
    mustNot: prose("Must not"),
    accept,
    threshold,
  };
}

/** The text sent to the generator: the Prompt, then the Must not list as one sentence. */
export function composePrompt(sheet) {
  const list = sheet.mustNot.replace(/[.\s]+$/, "");
  return `${sheet.prompt} It must not contain any of: ${list.charAt(0).toLowerCase()}${list.slice(1)}.`;
}

/** The shipped image's file name: the Slot, the Scheme when the sheet names one, the format. */
export function imageFileName(sheet) {
  return `${sheet.slot}${sheet.scheme ? `.${sheet.scheme}` : ""}.${sheet.output}`;
}

/**
 * The alpha check of a transparent Slot over raw RGBA pixels: the share of fully transparent pixels meets
 * `threshold` and all four corners are fully transparent.
 */
export function checkAlpha({ data, width, height, channels }, threshold) {
  if (channels !== 4) return { ok: false, detail: "the image has no alpha channel" };
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] === 0) clear++;
  const share = clear / (width * height);
  const at = (x, y) => data[(y * width + x) * 4 + 3];
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const opaque = corners.filter((a) => a !== 0).length;
  const problems = [];
  if (share < threshold) problems.push(`${(share * 100).toFixed(1)} % of pixels transparent, under ${(threshold * 100).toFixed(0)} %`);
  if (opaque) problems.push(`${opaque} corner${opaque > 1 ? "s" : ""} not transparent`);
  return { ok: problems.length === 0, share, detail: problems.join("; ") };
}

const TEXT_TOKENS = (contract) => [
  "--fg",
  "--muted",
  "--accent",
  "--danger",
  ...contract.tokens.map((t) => t.name).filter((n) => n.startsWith("--series-") || n.startsWith("--state-")),
];
const BOUND_STEPS = 1024;

/**
 * The backdrop's luminance bound for one Scheme (07 §6): walking from `--bg` towards white (dark Scheme) or
 * black (light Scheme), the last pixel over which every text and data Token keeps 4.5:1 against `--bg-raised`
 * composited over it. `limit` is that pixel's relative luminance: a ceiling when darkening, a floor when
 * lightening. An opaque `--bg-raised` hides the backdrop, so the walk reaches the end and nothing is bounded.
 * @returns {{scheme: string, direction: "darken" | "lighten", limit: number, toward: {r: number, g: number, b: number}}}
 */
export function backdropBound(values, scheme, contract) {
  const colour = (name) => {
    const c = parseColor(values.get(name));
    if (!c) throw new Error(`${name} "${values.get(name)}" is not a colour the clamp can evaluate`);
    return c;
  };
  const bg = colour("--bg");
  const raised = colour("--bg-raised");
  const texts = TEXT_TOKENS(contract).map(colour);
  const end = scheme === "dark" ? 255 : 0;
  const pixelAt = (s) => ({ r: bg.r + (end - bg.r) * s, g: bg.g + (end - bg.g) * s, b: bg.b + (end - bg.b) * s, a: 1 });
  const passes = (pixel) => {
    const surface = flatten(raised, pixel);
    return texts.every((t) => contrastRatio(flatten(t, surface), surface) >= AA);
  };
  if (!passes(pixelAt(0))) throw new Error(`the ${scheme} Tokens miss 4.5:1 over --bg itself`);
  let k = 0;
  while (k < BOUND_STEPS && passes(pixelAt((k + 1) / BOUND_STEPS))) k++;
  const limit = k === BOUND_STEPS ? (scheme === "dark" ? 1 : 0) : relativeLuminance(pixelAt(k / BOUND_STEPS));
  return { scheme, direction: scheme === "dark" ? "darken" : "lighten", limit, toward: { r: bg.r, g: bg.g, b: bg.b } };
}

// Linear-light value of each 8-bit channel, so a pixel's luminance is three lookups.
const LINEAR = Float64Array.from({ length: 256 }, (_, v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const pixelLuminance = (d, i) => 0.2126 * LINEAR[d[i]] + 0.7152 * LINEAR[d[i + 1]] + 0.0722 * LINEAR[d[i + 2]];

const BINS = 1 << 16;

/**
 * The luminance at the edge of the image's brightest (`high`) or darkest 0.1 % of pixels, read from a
 * histogram of 65536 bins and rounded outwards (up for the brightest, down for the darkest), so a clamp that
 * meets the bound on this value meets it on the exact one too.
 */
function tailLuminance(data, channels, high) {
  const n = data.length / channels;
  const hist = new Uint32Array(BINS);
  for (let i = 0; i < data.length; i += channels) hist[Math.min(BINS - 1, Math.floor(pixelLuminance(data, i) * BINS))]++;
  const rank = Math.floor((high ? 1 - TAIL : TAIL) * (n - 1)); // the 0-based rank in ascending order
  let seen = 0;
  for (let b = 0; b < BINS; b++) {
    seen += hist[b];
    if (seen > rank) return high ? Math.min(1, (b + 1) / BINS) : b / BINS;
  }
  return 1;
}

const meets = (data, channels, bound) =>
  bound.direction === "darken" ? tailLuminance(data, channels, true) <= bound.limit : tailLuminance(data, channels, false) >= bound.limit;

/** Every pixel moved the fraction `t` of the way to `toward`, rounded to 8 bits. */
function blend(data, channels, toward, t) {
  const out = Buffer.from(data);
  const target = [toward.r, toward.g, toward.b];
  for (let i = 0; i < out.length; i += channels)
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(data[i + c] + (target[c] - data[i + c]) * t);
  return out;
}

const CLAMP_STEPS = 256;

/**
 * The deterministic clamp of a backdrop's raw pixels against each bound in turn: the smallest step of
 * blending towards the bound's `--bg` (in 1/256ths) after which its brightest or darkest 0.1 % meets it.
 * A compliant image comes back unchanged. Throws when the bounds cannot all be met at once.
 * @param {{data: Buffer, width: number, height: number, channels: number}} raw
 * @param {ReturnType<typeof backdropBound>[]} bounds
 */
export function clampBackdrop(raw, bounds) {
  const { channels } = raw;
  let data = raw.data;
  let changed = false;
  for (const bound of bounds) {
    if (meets(data, channels, bound)) continue;
    let lo = 0;
    let hi = CLAMP_STEPS; // the whole way is --bg itself, which meets its own Scheme's bound
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (meets(blend(data, channels, bound.toward, mid / CLAMP_STEPS), channels, bound)) hi = mid;
      else lo = mid;
    }
    data = blend(data, channels, bound.toward, hi / CLAMP_STEPS);
    changed = true;
  }
  const missed = bounds.filter((b) => !meets(data, channels, b));
  if (missed.length) {
    const schemes = bounds.map((b) => b.scheme).join(" and ");
    throw new Error(`no clamp meets the bounds of both Schemes (${schemes}) at once; make the backdrop per Scheme`);
  }
  return { ...raw, data, changed };
}

/** Resize, check and encode one generated image for its sheet; the bytes to ship, or a reason it fails. */
async function postProcess(source, sheet, bounds) {
  const { width, height } = sheet.ship;
  if (sheet.background === "transparent") {
    const { data, info } = await sharp(source)
      .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alpha = checkAlpha({ data, width: info.width, height: info.height, channels: info.channels }, sheet.threshold);
    if (!alpha.ok) return { retry: true, reason: `the alpha check failed (${alpha.detail})` };
    const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    return { bytes: png };
  }
  const { data, info } = await sharp(source).resize(width, height, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const clamped = clampBackdrop({ data, width: info.width, height: info.height, channels: info.channels }, bounds);
  const webp = await sharp(clamped.data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  return { bytes: webp };
}

/** Write or replace one image's entry in the Theme's `provenance.json`, keeping every other entry. */
function recordProvenance(themeDir, entry) {
  const path = join(themeDir, "provenance.json");
  const doc = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { format: PROVENANCE_FORMAT, images: [] };
  const images = Array.isArray(doc.images) ? doc.images : [];
  const at = images.findIndex((e) => e.file === entry.file);
  if (at >= 0) images[at] = entry;
  else images.push(entry);
  writeFileSync(path, JSON.stringify({ format: PROVENANCE_FORMAT, images }, null, 2) + "\n");
}

const sha256 = (b) => createHash("sha256").update(b).digest("hex");

/**
 * Generate every missing image (or all with `force`) of every Theme's Prompt sheets under `root`.
 * @param {object} o
 * @param {string} o.root the library's root, holding `tokens.json` and `themes/`
 * @param {{name: string, model: string, generate: (request: {prompt: string, size: string, background: string}) => Promise<Buffer>}} o.generator
 * @param {string} [o.theme] only this Theme
 * @param {string} [o.slot] only this Slot
 * @param {boolean} [o.force] regenerate images that are already shipped
 * @param {() => Date} [o.now]
 * @param {(line: string) => void} [o.log]
 * @returns {Promise<{written: string[], failures: string[]}>}
 */
export async function generateAssets({ root, generator, theme, slot, force = false, now = () => new Date(), log = () => {} }) {
  const contract = JSON.parse(readFileSync(join(root, "tokens.json"), "utf8"));
  let themes = loadThemes(root);
  if (theme !== undefined) {
    themes = themes.filter((t) => t.id === theme);
    if (!themes.length) throw new Error(`there is no Theme "${theme}" under themes/`);
  }
  if (slot !== undefined && !(slot in SLOT_TABLE)) throw new Error(`"${slot}" is not a Slot with an image (${Object.keys(SLOT_TABLE).join(", ")})`);

  const written = [];
  const failures = [];
  for (const t of themes) {
    const promptsDir = join(t.path, "prompts");
    if (!existsSync(promptsDir)) continue;
    const declared = t.manifest?.schemes ?? [];
    for (const name of readdirSync(promptsDir).filter((n) => n.endsWith(".md")).sort()) {
      const where = `themes/${t.id}/prompts/${name}`;
      const fail = (reason) => failures.push(`${where}: ${reason}`);
      const text = readFileSync(join(promptsDir, name), "utf8");
      let sheet;
      try {
        sheet = parseSheet(text, name);
      } catch (e) {
        fail(e.message);
        continue;
      }
      if (slot !== undefined && sheet.slot !== slot) continue;
      if (sheet.scheme && !declared.includes(sheet.scheme)) {
        fail(`names the undeclared Scheme "${sheet.scheme}"`);
        continue;
      }
      const file = imageFileName(sheet);
      if (!force && existsSync(join(t.path, file))) continue;

      let bounds = [];
      try {
        if (sheet.slot === "backdrop")
          bounds = (sheet.scheme ? [sheet.scheme] : declared).map((s) =>
            backdropBound(resolveTokens({ contract, css: t.css, id: t.id, scheme: s, intensity: 0.5 }), s, contract),
          );
      } catch (e) {
        fail(e.message);
        continue;
      }

      const request = { prompt: composePrompt(sheet), size: sheet.size, background: sheet.background };
      let result;
      try {
        for (let attempt = 0; attempt <= ALPHA_RETRIES; attempt++) {
          result = await postProcess(await generator.generate(request), sheet, bounds);
          if (!result.retry) break;
        }
      } catch (e) {
        fail(e.message);
        continue;
      }
      if (result.retry) {
        fail(`${result.reason} after ${ALPHA_RETRIES + 1} attempts; the fallback stays in force`);
        continue;
      }
      const budget = SLOT_TABLE[sheet.slot].budget;
      if (result.bytes.length > budget) {
        fail(`${file} is ${result.bytes.length} bytes after compression, over its budget of ${budget} bytes`);
        continue;
      }

      writeFileSync(join(t.path, file), result.bytes);
      recordProvenance(t.path, {
        file,
        generator: generator.name,
        model: generator.model,
        generated_at: now().toISOString().slice(0, 10),
        prompt_sha256: sha256(text),
        sha256: sha256(result.bytes),
        bytes: result.bytes.length,
      });
      written.push(`themes/${t.id}/${file}`);
      const key = `assets.${sheet.slot}${sheet.scheme ? `.${sheet.scheme}` : ""}`;
      log(`themes/${t.id}/theme.json, ${key}: "image": "${file}"`);
    }
  }
  return { written, failures };
}
