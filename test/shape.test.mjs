import { describe, expect, test } from "vitest";
import { checkThemeShape } from "../scripts/lib/shape.mjs";
import { contract, themes } from "./helpers.mjs";

describe.each(themes.map((t) => [t.id, t]))("theme.css of %s", (_id, theme) => {
  test("holds Token declarations only", () => {
    expect(checkThemeShape({ id: theme.id, css: theme.css, manifest: theme.manifest, contract })).toEqual([]);
  });
});

const manifest = { id: "sample", label: "Sample", schemes: ["light", "dark"], intensity: false, assets: {} };
const check = (css, m = manifest) => checkThemeShape({ id: "sample", css, manifest: m, contract });
const base = (body) => `html[data-theme="sample"] {\n  --bg: #ffffff;\n${body}\n}\n`;

describe("a synthetic Theme file", () => {
  test("of contract Tokens, --theme-* helpers and color-scheme passes", () => {
    const css = `/* a comment */\n${base("  --theme-tint: #102030;\n  --fg: var(--theme-tint);")}
html[data-theme="sample"][data-scheme="dark"] {\n  color-scheme: dark;\n  --bg: #000000;\n}\n`;
    expect(check(css)).toEqual([]);
  });

  test("with a component selector fails on that line", () => {
    const css = `${base("")}\n.button {\n  --accent: #ff0000;\n}\n`;
    expect(check(css)).toContainEqual(expect.objectContaining({ line: 6, rule: "selector" }));
  });

  test("with a descendant selector under the Theme fails", () => {
    const css = `html[data-theme="sample"] .card {\n  --bg: #ffffff;\n}\n`;
    expect(check(css)).toContainEqual(expect.objectContaining({ line: 1, rule: "selector" }));
  });

  test("with a selector for another Theme fails", () => {
    const css = `html[data-theme="other"] {\n  --bg: #ffffff;\n}\n`;
    expect(check(css)).toContainEqual(expect.objectContaining({ line: 1, rule: "selector" }));
  });

  test.each(["padding: 4px;", "font-size: 14px;", "animation: spin 1s;", "display: grid;"])(
    "with the property %s fails on its line",
    (decl) => {
      expect(check(base(`  ${decl}`))).toContainEqual(expect.objectContaining({ line: 3, rule: "property" }));
    },
  );

  test.each(["--kind-model", "--status-running"])("setting the consumer name %s fails", (name) => {
    expect(check(base(`  ${name}: #123456;`))).toContainEqual(
      expect.objectContaining({ line: 3, rule: "consumer_name" }),
    );
  });

  test("setting a custom property outside the contract fails", () => {
    expect(check(base("  --spacing-2: 4px;"))).toContainEqual(expect.objectContaining({ line: 3, rule: "property" }));
  });

  test("setting --intensity fails", () => {
    expect(check(base("  --intensity: 1;"))).toContainEqual(expect.objectContaining({ line: 3, rule: "property" }));
  });

  test("with a url() outside @font-face fails", () => {
    const m = { ...manifest, intensity: true };
    const css = base(`  --asset-backdrop: url(/themes/sample/backdrop.svg);\n  --glow: 0 0 calc(var(--intensity) * 4px) red;\n  --glow-svg: drop-shadow(0 0 calc(var(--intensity) * 4px) red);`);
    expect(check(css, m)).toContainEqual(expect.objectContaining({ line: 3, rule: "url" }));
  });

  const face = (src = 'url(/themes/sample/face-400.woff2) format("woff2")', display = "swap") =>
    `@font-face {\n  font-family: "Face";\n  src: ${src};\n  font-display: ${display};\n  font-weight: 400 700;\n}\n`;

  test("with one well-formed @font-face passes", () => {
    expect(check(face() + base(""))).toEqual([]);
  });

  test("with a second @font-face fails on its line", () => {
    const css = face() + face();
    expect(check(css)).toContainEqual(expect.objectContaining({ line: 7, rule: "font_face" }));
  });

  test("with a @font-face src outside the Theme's directory fails", () => {
    expect(check(face('url(https://fonts.example/face.woff2) format("woff2")'))).toContainEqual(
      expect.objectContaining({ line: 3, rule: "font_face" }),
    );
  });

  test("with a @font-face whose font-display is not swap fails", () => {
    expect(check(face(undefined, "block"))).toContainEqual(expect.objectContaining({ line: 4, rule: "font_face" }));
  });

  test("with another at-rule fails", () => {
    const css = `@media (min-width: 40em) {\n  html[data-theme="sample"] {\n    --bg: #ffffff;\n  }\n}\n`;
    expect(check(css)).toContainEqual(expect.objectContaining({ line: 1, rule: "at_rule" }));
  });

  test("with a block for an undeclared Scheme fails", () => {
    const m = { ...manifest, schemes: ["dark"] };
    const css = `html[data-theme="sample"][data-scheme="light"] {\n  color-scheme: light;\n}\n`;
    expect(check(css, m)).toContainEqual(expect.objectContaining({ line: 1, rule: "scheme" }));
  });

  test("with a Scheme block whose color-scheme names the other Scheme fails", () => {
    const css = `html[data-theme="sample"][data-scheme="dark"] {\n  color-scheme: light;\n}\n`;
    expect(check(css)).toContainEqual(expect.objectContaining({ line: 2, rule: "scheme" }));
  });

  test("declaring intensity: false and moving a decoration Token fails", () => {
    expect(check(base("  --glow: 0 0 4px #ff00ff;"))).toContainEqual(
      expect.objectContaining({ line: 3, rule: "intensity" }),
    );
  });

  test("declaring intensity: false and restating a decoration default passes", () => {
    expect(check(base("  --glow: none;\n  --font-display: var(--font-sans);"))).toEqual([]);
  });

  test("declaring intensity: true without --intensity in --glow and --glow-svg fails", () => {
    const m = { ...manifest, intensity: true };
    const findings = check(base("  --glow: 0 0 4px #ff00ff;"), m);
    expect(findings).toContainEqual(expect.objectContaining({ rule: "intensity", detail: expect.stringContaining("--glow ") }));
    expect(findings).toContainEqual(expect.objectContaining({ rule: "intensity", detail: expect.stringContaining("--glow-svg") }));
  });

  test("with a nested block fails", () => {
    const css = `html[data-theme="sample"] {\n  --bg: #ffffff;\n  & .x {\n    --fg: #000000;\n  }\n}\n`;
    expect(check(css)).toContainEqual(expect.objectContaining({ line: 3, rule: "nesting" }));
  });

  test("names the offending line in every finding", () => {
    const findings = check(`${base("  margin: 0;")}\n.x { --bg: #000; }\n`);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) expect(typeof f.line).toBe("number");
  });
});
