import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { build } from "../scripts/build.mjs";
import { parseStylesheet } from "../scripts/lib/css.mjs";
import { resolveTokens } from "../scripts/lib/contrast.mjs";
import { loadThemes } from "../scripts/lib/registry.mjs";
import { contract, root, slots, themes } from "./helpers.mjs";

const out = mkdtempSync(join(tmpdir(), "dyeworks-dist-"));
const scratch = [out];
afterAll(() => {
  for (const d of scratch) rmSync(d, { recursive: true, force: true });
});
build(root, out);
const read = (name) => readFileSync(join(out, name), "utf8");

describe("dist/tokens.css", () => {
  const { blocks } = parseStylesheet(read("tokens.css"));

  test("is one :root block with color-scheme light and every contract default", () => {
    expect(blocks.map((b) => b.prelude)).toEqual([":root"]);
    const decls = Object.fromEntries(blocks[0].declarations.map((d) => [d.property, d.value]));
    expect(decls["color-scheme"]).toBe("light");
    for (const t of contract.tokens) expect(decls[t.name], t.name).toBe(t.default);
    expect(Object.keys(decls)).toHaveLength(contract.tokens.length + 1);
  });

  test("renders a page with no Theme attribute as default light", () => {
    const defaultLight = resolveTokens({ contract, css: themes[0].css, id: "default", scheme: "light", intensity: 0.5 });
    const bare = resolveTokens({ contract, css: "", id: "default", scheme: "light", intensity: 0.5 });
    for (const t of contract.tokens) expect(bare.get(t.name), t.name).toBe(defaultLight.get(t.name));
  });
});

test("dist/themes.css holds every Theme's declarations", () => {
  const text = read("themes.css");
  for (const t of themes) expect(text).toContain(t.css.trim());
});

describe("dist/registry.js", () => {
  test("exports themes with default first and the menu options", async () => {
    const registry = await import(pathToFileURL(join(out, "registry.js")).href);
    expect(registry.themes[0]).toEqual({ id: "default", label: "Default", schemes: ["light", "dark"], intensity: false, assets: {} });
    expect(registry.themes.map((t) => t.id)).toEqual(themes.map((t) => t.id));
    expect(registry.options().slice(0, 3)).toEqual([
      { theme: "default", scheme: "auto", label: "Default · auto" },
      { theme: "default", scheme: "light", label: "Default · light" },
      { theme: "default", scheme: "dark", label: "Default · dark" },
    ]);
  });

  test("puts default first whatever the other directories are called, and gives a one-Scheme Theme one option", async () => {
    const synthetic = mkdtempSync(join(tmpdir(), "dyeworks-root-"));
    scratch.push(synthetic);
    for (const name of ["tokens.json", "slots.json"]) writeFileSync(join(synthetic, name), readFileSync(join(root, name)));
    const theme = (id, manifest) => {
      mkdirSync(join(synthetic, "themes", id), { recursive: true });
      writeFileSync(join(synthetic, "themes", id, "theme.json"), JSON.stringify(manifest));
      writeFileSync(join(synthetic, "themes", id, "theme.css"), `html[data-theme="${id}"] {}\n`);
    };
    theme("zeta", { id: "zeta", label: "Zeta", schemes: ["dark"], intensity: true, assets: {} });
    theme("default", { id: "default", label: "Default", schemes: ["light", "dark"], intensity: false, assets: {} });
    theme("alpha", { id: "alpha", label: "Alpha", schemes: ["light"], intensity: false, assets: {} });
    expect(loadThemes(synthetic).map((t) => t.id)).toEqual(["default", "alpha", "zeta"]);
    const dist = join(synthetic, "dist");
    build(synthetic, dist);
    const registry = await import(pathToFileURL(join(dist, "registry.js")).href);
    expect(registry.options().slice(3)).toEqual([
      { theme: "alpha", scheme: "light", label: "Alpha" },
      { theme: "zeta", scheme: "dark", label: "Zeta" },
    ]);
  });
});

test("the reference page lists every Token and every Slot kind", () => {
  const page = read("reference.html");
  for (const t of contract.tokens) expect(page).toContain(`<code>${t.name}</code>`);
  for (const s of slots.slots) expect(page).toContain(`<code>${s.kind}</code>`);
});

test("tokens.json carries every Token of the contract table with its tier and type", () => {
  expect(contract.format).toBe("dyeworks-tokens/1");
  expect(contract.schemes).toEqual(["light", "dark"]);
  const byTier = (tier) => contract.tokens.filter((t) => t.tier === tier).map((t) => t.name);
  expect(byTier("surface")).toEqual(["--bg", "--bg-raised", "--bg-sunken", "--fg", "--muted", "--border", "--accent", "--accent-fg", "--selected", "--radius", "--font-sans", "--font-mono"]);
  expect(byTier("data")).toEqual(["--series-1", "--series-2", "--series-3", "--state-active", "--state-quiet", "--state-attention", "--state-success", "--state-failure", "--state-halted", "--danger", "--warning-bg", "--warning-fg"]);
  expect(byTier("decoration")).toEqual(["--glow", "--glow-svg", "--accent-gradient", "--font-display", "--asset-backdrop", "--asset-ornament", "--asset-empty", "--asset-opacity"]);
  const types = Object.fromEntries(contract.tokens.map((t) => [t.name, t.type]));
  expect(types).toMatchObject({ "--radius": "length", "--font-sans": "font_family", "--glow": "box_shadow", "--glow-svg": "filter", "--accent-gradient": "background_image", "--font-display": "font_family", "--asset-backdrop": "image", "--asset-opacity": "number" });
  for (const t of contract.tokens) {
    expect(Object.keys(t)).toEqual(["name", "tier", "type", "meaning", "default"]);
    expect(t.meaning).toMatch(/^[A-Z-].*\.$/);
  }
});
