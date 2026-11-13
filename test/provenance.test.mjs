import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { checkThemeFiles } from "../scripts/lib/provenance.mjs";
import { themes } from "./helpers.mjs";

describe.each(themes.map((t) => [t.id, t]))("the files of %s", (_id, theme) => {
  test("have provenance, licences and stay under budget", () => {
    expect(checkThemeFiles(theme.path)).toEqual([]);
  });
});

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const themeDir = (files) => {
  const dir = mkdtempSync(join(tmpdir(), "dyeworks-provenance-"));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
};
const sha = (b) => createHash("sha256").update(b).digest("hex");
const entry = (file, bytes) => ({ file, generator: "openai-images", model: "gpt-image-1", generated_at: "2026-11-11", prompt_sha256: sha("sheet"), sha256: sha(bytes), bytes: bytes.length });
const provenance = (...images) => JSON.stringify({ format: "dyeworks-provenance/1", images });
const rules = (dir) => checkThemeFiles(dir).map((f) => f.rule);

describe("a synthetic Theme directory", () => {
  const png = Buffer.alloc(1000, 1);

  test("with an image listed in provenance.json passes", () => {
    expect(checkThemeFiles(themeDir({ "ornament.png": png, "provenance.json": provenance(entry("ornament.png", png)) }))).toEqual([]);
  });

  test("with an image and no provenance.json fails", () => {
    expect(rules(themeDir({ "ornament.png": png }))).toContain("provenance");
  });

  test("with an image missing from provenance.json fails", () => {
    expect(rules(themeDir({ "ornament.png": png, "empty.png": png, "provenance.json": provenance(entry("ornament.png", png)) }))).toContain("provenance");
  });

  test("whose image's digest does not match fails", () => {
    const other = Buffer.alloc(1000, 2);
    expect(rules(themeDir({ "ornament.png": png, "provenance.json": provenance(entry("ornament.png", other)) }))).toContain("provenance");
  });

  test("whose image's size does not match fails", () => {
    const e = { ...entry("ornament.png", png), bytes: 999 };
    expect(rules(themeDir({ "ornament.png": png, "provenance.json": provenance(e) }))).toContain("provenance");
  });

  test("whose provenance entry lacks a field fails", () => {
    const { model: _model, ...e } = entry("ornament.png", png);
    expect(rules(themeDir({ "ornament.png": png, "provenance.json": provenance(e) }))).toContain("provenance");
  });

  test("whose provenance lists a file that is not there fails", () => {
    expect(rules(themeDir({ "provenance.json": provenance(entry("empty.png", png)) }))).toContain("provenance");
  });

  test.each([
    ["ornament.png", 40_001],
    ["empty.dark.png", 200_001],
    ["backdrop.light.webp", 400_001],
  ])("with %s over its budget fails", (name, size) => {
    const big = Buffer.alloc(size, 3);
    expect(rules(themeDir({ [name]: big, "provenance.json": provenance(entry(name, big)) }))).toContain("budget");
  });

  test("with a raster that is not named after a Slot fails", () => {
    expect(rules(themeDir({ "dunes.png": png, "provenance.json": provenance(entry("dunes.png", png)) }))).toContain("name");
  });

  test("with a face and OFL.txt beside it passes", () => {
    expect(checkThemeFiles(themeDir({ "face-400.woff2": Buffer.alloc(50_000), "OFL.txt": "SIL Open Font License" }))).toEqual([]);
  });

  test("with a face and no OFL.txt fails", () => {
    expect(rules(themeDir({ "face-400.woff2": Buffer.alloc(50_000) }))).toContain("licence");
  });

  test("with a face over 120 kB fails", () => {
    expect(rules(themeDir({ "face-400.woff2": Buffer.alloc(120_001), "OFL.txt": "x" }))).toContain("budget");
  });

  test("with two faces fails", () => {
    expect(rules(themeDir({ "a.woff2": Buffer.alloc(10), "b.woff2": Buffer.alloc(10), "OFL.txt": "x" }))).toContain("font");
  });

  test.each(["face.ttf", "face.otf", "face.woff"])("with a %s fails", (name) => {
    expect(rules(themeDir({ [name]: Buffer.alloc(10), "OFL.txt": "x" }))).toContain("font");
  });

  test("with a fallback SVG over 8 kB fails", () => {
    expect(rules(themeDir({ "backdrop.svg": `<svg>${" ".repeat(8_001)}</svg>` }))).toContain("budget");
  });
});
