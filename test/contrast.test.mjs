import { describe, expect, test } from "vitest";
import { contrastRatio, deltaE76, flatten, parseColor, toHex } from "../scripts/lib/color.mjs";
import { checkContrast, resolveTokens } from "../scripts/lib/contrast.mjs";
import { contract, themes } from "./helpers.mjs";

const pairs = themes.flatMap((t) => (t.manifest?.schemes ?? []).map((s) => [`${t.id} ${s}`, t, s]));

describe.each(pairs)("%s", (_name, theme, scheme) => {
  test("meets ADR 0016 §7's thresholds at Intensity 0.5", () => {
    const values = resolveTokens({ contract, css: theme.css, id: theme.id, scheme, intensity: 0.5 });
    expect(checkContrast(values, contract)).toEqual([]);
  });
});

describe("the colour maths", () => {
  test("parses hex and rgb() forms", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#11223380")).toEqual({ r: 17, g: 34, b: 51, a: 128 / 255 });
    expect(parseColor("rgba(255, 111, 60, 0.25)")).toEqual({ r: 255, g: 111, b: 60, a: 0.25 });
    expect(parseColor("rgb(1 2 3 / 50%)")).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(parseColor("var(--x)")).toBeNull();
  });

  test("flattens a translucent surface over the base", () => {
    // 07 §2.4: psychedelic's raised surface flattens to #2d1e3f over its base
    expect(toHex(flatten(parseColor("rgba(255, 255, 255, 0.08)"), parseColor("#1b0a2e")))).toBe("#2d1e3f");
  });

  test("measures WCAG contrast", () => {
    expect(contrastRatio(parseColor("#ffffff"), parseColor("#000000"))).toBeCloseTo(21, 5);
    expect(contrastRatio(parseColor("#777777"), parseColor("#ffffff"))).toBeCloseTo(4.48, 2);
  });

  test("measures CIE76 ΔE", () => {
    expect(deltaE76(parseColor("#000000"), parseColor("#ffffff"))).toBeCloseTo(100, 1);
    expect(deltaE76(parseColor("#ff0000"), parseColor("#ff0000"))).toBe(0);
  });
});

describe("resolving a Theme's Tokens", () => {
  const css = `html[data-theme="t"][data-scheme="dark"] {\n  --bg: #000000;\n}\nhtml[data-theme="t"] {\n  --bg: #ffffff;\n  --theme-x: #123456;\n  --accent: var(--theme-x);\n  --glow: 0 0 calc(var(--intensity) * 10px) var(--accent);\n}\n`;

  test("starts from the contract defaults", () => {
    const v = resolveTokens({ contract, css: "", id: "t", scheme: "light", intensity: 0.5 });
    expect(v.get("--fg")).toBe(contract.tokens.find((t) => t.name === "--fg").default);
    expect(v.get("--accent-gradient")).toBe(v.get("--accent"));
  });

  test("lets a Scheme block win over the base block whatever their order", () => {
    expect(resolveTokens({ contract, css, id: "t", scheme: "dark", intensity: 0.5 }).get("--bg")).toBe("#000000");
    expect(resolveTokens({ contract, css, id: "t", scheme: "light", intensity: 0.5 }).get("--bg")).toBe("#ffffff");
  });

  test("substitutes var() reads and --intensity", () => {
    const v = resolveTokens({ contract, css, id: "t", scheme: "light", intensity: 0.5 });
    expect(v.get("--accent")).toBe("#123456");
    expect(v.get("--glow")).toBe("0 0 calc(0.5 * 10px) #123456");
  });
});

describe("a synthetic palette", () => {
  const base = resolveTokens({ contract, css: "", id: "t", scheme: "light", intensity: 0.5 });
  const withValues = (patch) => new Map([...base, ...Object.entries(patch)]);

  test("of the contract defaults passes", () => {
    expect(checkContrast(base, contract)).toEqual([]);
  });

  test("whose muted text is too faint fails", () => {
    const found = checkContrast(withValues({ "--muted": "#bbbbbb" }), contract);
    expect(found).toContainEqual(expect.objectContaining({ rule: "contrast", detail: expect.stringContaining("--muted on --bg") }));
  });

  test("measured on a translucent raised surface flattens it first", () => {
    // fully transparent raised surface: it is the base, so the raised pairs measure as the base pairs
    expect(checkContrast(withValues({ "--bg-raised": "rgba(0, 0, 0, 0)" }), contract)).toEqual([]);
  });

  test("with two series colours too alike fails", () => {
    const found = checkContrast(withValues({ "--series-2": "#3a48c4" }), contract);
    expect(found).toContainEqual(expect.objectContaining({ rule: "delta_e", detail: expect.stringContaining("--series-1 and --series-2") }));
  });

  test("with two state colours too alike fails", () => {
    const found = checkContrast(withValues({ "--state-failure": "#1c65b5" }), contract);
    expect(found).toContainEqual(expect.objectContaining({ rule: "delta_e", detail: expect.stringContaining("--state-active and --state-failure") }));
  });

  test("with a colour it cannot evaluate fails", () => {
    expect(checkContrast(withValues({ "--fg": "currentColor" }), contract)).toContainEqual(expect.objectContaining({ rule: "unparsed" }));
  });

  test.each([
    ["--accent-fg", "#8090ff", "--accent-fg on --accent"],
    ["--warning-fg", "#ffd9a0", "--warning-fg on --warning-bg"],
    ["--selected", "#3a3f5a", "--fg on --selected"],
  ])("whose %s breaks its pair fails", (name, value, pair) => {
    expect(checkContrast(withValues({ [name]: value }), contract)).toContainEqual(
      expect.objectContaining({ rule: "contrast", detail: expect.stringContaining(pair) }),
    );
  });
});
