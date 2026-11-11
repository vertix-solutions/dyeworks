import { describe, expect, test } from "vitest";
import { checkManifest } from "../scripts/lib/manifest.mjs";
import { themes } from "./helpers.mjs";

describe.each(themes.map((t) => [t.id, t]))("theme.json of %s", (_id, theme) => {
  test("follows the manifest schema and names only files that exist", () => {
    expect(theme.manifest).not.toBeNull();
    expect(theme.css).not.toBeNull();
    expect(checkManifest({ dirName: theme.id, manifest: theme.manifest, files: theme.files })).toEqual([]);
  });
});

test("the default Theme is the one 07 §2.1 fixes", () => {
  expect(themes[0].manifest).toEqual({ id: "default", label: "Default", schemes: ["light", "dark"], intensity: false, assets: {} });
});

const good = { id: "sample", label: "Sample", schemes: ["light", "dark"], intensity: true, assets: {} };
const files = ["theme.css", "theme.json", "backdrop.svg", "backdrop.webp", "backdrop.light.svg", "backdrop.dark.svg", "ornament.svg", "empty.svg"];
const check = (manifest, f = files, dirName = "sample") => checkManifest({ dirName, manifest, files: f });
const rules = (manifest, f, d) => check(manifest, f, d).map((x) => x.rule);

describe("a synthetic manifest", () => {
  test("with a shared and a per-Scheme asset passes", () => {
    const m = { ...good, assets: { backdrop: { light: { fallback: "backdrop.light.svg" }, dark: { fallback: "backdrop.dark.svg" } }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } } };
    expect(check(m)).toEqual([]);
  });

  test("with an image beside its fallback passes", () => {
    expect(check({ ...good, assets: { backdrop: { fallback: "backdrop.svg", image: "backdrop.webp" } } })).toEqual([]);
  });

  test("whose id is not the directory name fails", () => {
    expect(rules(good, files, "other")).toContain("id");
  });

  test("whose id is not snake_case fails", () => {
    expect(rules({ ...good, id: "Sample-Theme" }, files, "Sample-Theme")).toContain("id");
  });

  test.each([
    ["an empty label", { label: "" }, "label"],
    ["no Scheme", { schemes: [] }, "schemes"],
    ["an unknown Scheme", { schemes: ["dusk"] }, "schemes"],
    ["a repeated Scheme", { schemes: ["dark", "dark"] }, "schemes"],
    ["a non-boolean intensity", { intensity: "yes" }, "intensity"],
    ["assets that are not an object", { assets: [] }, "assets"],
    ["an unknown asset key", { assets: { cursor: { fallback: "cursor.svg" } } }, "assets"],
    ["an unknown top-level key", { font: "face.woff2" }, "unknown_key"],
  ])("with %s fails", (_what, patch, rule) => {
    expect(rules({ ...good, ...patch })).toContain(rule);
  });

  test("missing a field fails", () => {
    const { label: _label, ...rest } = good;
    expect(rules(rest)).toContain("label");
  });

  test("whose fallback is not an SVG fails", () => {
    expect(rules({ ...good, assets: { backdrop: { fallback: "backdrop.webp" } } })).toContain("assets");
  });

  test("whose entry has no fallback fails", () => {
    expect(rules({ ...good, assets: { backdrop: { image: "backdrop.webp" } } })).toContain("assets");
  });

  test("whose entry carries another key fails", () => {
    expect(rules({ ...good, assets: { backdrop: { fallback: "backdrop.svg", alt: "dunes" } } })).toContain("assets");
  });

  test("whose image is not png or webp fails", () => {
    expect(rules({ ...good, assets: { backdrop: { fallback: "backdrop.svg", image: "backdrop.jpg" } } }, [...files, "backdrop.jpg"])).toContain("assets");
  });

  test("whose file name carries more than the Slot name and Scheme fails", () => {
    expect(rules({ ...good, assets: { backdrop: { fallback: "dunes.svg" } } }, [...files, "dunes.svg"])).toContain("assets");
  });

  test("whose per-Scheme file names the other Scheme fails", () => {
    const m = { ...good, assets: { backdrop: { light: { fallback: "backdrop.dark.svg" }, dark: { fallback: "backdrop.dark.svg" } } } };
    expect(rules(m)).toContain("assets");
  });

  test("naming a file that does not exist fails", () => {
    const found = check({ ...good, assets: { empty: { fallback: "empty.svg", image: "empty.png" } } });
    expect(found).toContainEqual(expect.objectContaining({ rule: "missing_file", detail: expect.stringContaining("empty.png") }));
  });

  test("with a per-Scheme entry missing a declared Scheme fails", () => {
    expect(rules({ ...good, assets: { backdrop: { light: { fallback: "backdrop.light.svg" } } } })).toContain("per_scheme");
  });

  test("with a per-Scheme entry naming an undeclared Scheme fails", () => {
    const m = { ...good, schemes: ["dark"], assets: { backdrop: { light: { fallback: "backdrop.light.svg" }, dark: { fallback: "backdrop.dark.svg" } } } };
    expect(rules(m)).toContain("per_scheme");
  });

  test("with a per-Scheme entry naming a Scheme outside light and dark fails", () => {
    expect(rules({ ...good, assets: { backdrop: { light: { fallback: "backdrop.light.svg" }, dark: { fallback: "backdrop.dark.svg" }, dusk: { fallback: "backdrop.svg" } } } })).toContain("per_scheme");
  });
});
