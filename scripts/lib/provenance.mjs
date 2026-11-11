// The provenance, licence and budget rules over the files of one Theme directory (07 §6).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { listFiles } from "./registry.mjs";

const RASTER = /\.(png|webp|jpe?g|gif)$/i;
const OTHER_FONT = /\.(woff|ttf|otf)$/i;
// Budgets in bytes (kB as 1000 bytes), by Slot.
const RASTER_BUDGET = { backdrop: 400_000, ornament: 40_000, empty: 200_000 };
const FONT_BUDGET = 120_000;
const FALLBACK_BUDGET = 8_000;
const ENTRY_FIELDS = ["file", "generator", "model", "generated_at", "prompt_sha256", "sha256", "bytes"];

/** @returns {{file: string, rule: string, detail: string}[]} */
export function checkThemeFiles(dir) {
  const findings = [];
  const add = (file, rule, detail) => findings.push({ file, rule, detail });
  const files = listFiles(dir);
  const bytesOf = (f) => readFileSync(join(dir, f));

  let entries = new Map();
  if (files.includes("provenance.json")) {
    const doc = JSON.parse(readFileSync(join(dir, "provenance.json"), "utf8"));
    if (doc.format !== "dyeworks-provenance/1") add("provenance.json", "provenance", `format is not dyeworks-provenance/1`);
    for (const e of Array.isArray(doc.images) ? doc.images : []) {
      const missing = ENTRY_FIELDS.filter((k) => !(k in e));
      if (missing.length) add("provenance.json", "provenance", `the entry for ${e.file ?? "?"} lacks ${missing.join(", ")}`);
      entries.set(e.file, e);
      if (!files.includes(e.file)) add("provenance.json", "provenance", `lists ${e.file}, which is not in the directory`);
    }
  }

  for (const file of files) {
    const name = basename(file);
    if (RASTER.test(name)) {
      const bytes = bytesOf(file);
      const slot = name.split(".")[0];
      if (!(slot in RASTER_BUDGET) || name.split(".").length > 3) add(file, "name", `${file} is not named <slot>[.<scheme>].<ext>`);
      else if (bytes.length > RASTER_BUDGET[slot]) add(file, "budget", `${file} is ${bytes.length} bytes, over ${RASTER_BUDGET[slot]}`);
      const e = entries.get(file);
      if (!e) add(file, "provenance", `${file} has no provenance.json entry`);
      else {
        const digest = createHash("sha256").update(bytes).digest("hex");
        if (e.sha256 !== digest) add(file, "provenance", `${file}'s sha256 does not match its entry`);
        if (e.bytes !== bytes.length) add(file, "provenance", `${file} is ${bytes.length} bytes, its entry says ${e.bytes}`);
      }
    } else if (name.endsWith(".woff2")) {
      const size = bytesOf(file).length;
      if (size > FONT_BUDGET) add(file, "budget", `${file} is ${size} bytes, over ${FONT_BUDGET}`);
      if (!existsSync(join(dir, dirname(file), "OFL.txt"))) add(file, "licence", `${file} has no OFL.txt beside it`);
    } else if (OTHER_FONT.test(name)) {
      add(file, "font", `${file}: a Theme's face is one woff2 file`);
    } else if (name.endsWith(".svg")) {
      const size = bytesOf(file).length;
      if (size > FALLBACK_BUDGET) add(file, "budget", `${file} is ${size} bytes, over ${FALLBACK_BUDGET}`);
    }
  }
  const faces = files.filter((f) => f.endsWith(".woff2"));
  if (faces.length > 1) add(faces[1], "font", `a Theme bundles at most one face; found ${faces.join(", ")}`);
  return findings;
}
