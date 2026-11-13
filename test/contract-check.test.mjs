import { describe, expect, test } from "vitest";
import { checkContract } from "../dist/contract-check.js";

const sheet = (text, path = "app.css") => ({ path, text });
const violations = (result) => result.filter((r) => !r.allowed);

describe("a conforming stylesheet", () => {
  test("passes with no findings", () => {
    const text = `
:root {
  --space-2: 8px;
  --kind-a: var(--series-1);
}
.card {
  background: var(--bg-raised);
  color: var(--fg);
  border: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  padding: var(--space-2);
  opacity: calc(0.5 + var(--intensity) / 2);
}
@media (min-width: 40rem) {
  .card:hover { outline: 2px solid var(--accent); fill: currentColor; background-color: transparent; }
}
.dot { fill: var(--kind-a); }
`;
    expect(checkContract({ stylesheets: [sheet(text)] })).toEqual([]);
  });
});

describe("rule 1: every var() read is a contract Token, --intensity or declared here", () => {
  test("an undeclared custom property is a violation with its line", () => {
    const result = checkContract({ stylesheets: [sheet(".a {\n  color: var(--fg);\n  border-color: var(--theme-edge);\n}")] });
    expect(result).toEqual([{ path: "app.css", line: 3, rule: 1, detail: expect.stringContaining("--theme-edge"), allowed: false }]);
  });

  test("a property declared in another stylesheet given counts as declared, and fallbacks are reads too", () => {
    const result = checkContract({
      stylesheets: [sheet(":root { --text-s: 12px; }", "a.css"), sheet(".b { font-size: var(--text-s, var(--nowhere)); }", "b.css")],
    });
    expect(result.map((r) => [r.path, r.rule, r.detail.includes("--nowhere")])).toEqual([["b.css", 1, true]]);
  });
});

describe("rule 2: no contract Token is set outside a Theme file", () => {
  test("setting --accent is a violation", () => {
    const result = checkContract({ stylesheets: [sheet(".x { color: var(--fg); }\n.y {\n  --accent: var(--fg);\n}")] });
    expect(result).toEqual([{ path: "app.css", line: 3, rule: 2, detail: expect.stringContaining("--accent"), allowed: false }]);
  });
});

describe("rule 3: no colour literal in a colour-bearing property", () => {
  test.each([
    ["a hex colour", "color: #123456"],
    ["a short hex colour", "border: 1px solid #abc"],
    ["rgb()", "background: rgb(10 20 30)"],
    ["hsl()", "outline-color: hsl(200deg 50% 50%)"],
    ["color()", "stroke: color(display-p3 1 0 0)"],
    ["color-mix() with a literal", "background-color: color-mix(in srgb, var(--accent) 40%, white)"],
    ["a named colour", "fill: rebeccapurple"],
    ["a named colour in a gradient", "background-image: linear-gradient(red, var(--accent))"],
    ["text-decoration", "text-decoration: underline wavy #f00"],
    ["accent-color", "accent-color: navy"],
  ])("%s is one violation", (_name, declaration) => {
    const result = checkContract({ stylesheets: [sheet(`.x { ${declaration}; }`)] });
    expect(result).toEqual([{ path: "app.css", line: 1, rule: 3, detail: expect.any(String), allowed: false }]);
  });

  test("color-mix() over Tokens and transparent is not a literal; a url() or a font name is never read as a colour", () => {
    const text = `.x {
  background: color-mix(in srgb, var(--accent) 20%, transparent) url("tan/red.svg");
  font-family: "Red Hat", var(--font-sans);
  border-color: currentcolor;
  --kind-red: var(--series-1);
  color: var(--kind-red);
}`;
    expect(checkContract({ stylesheets: [sheet(text)] })).toEqual([]);
  });

  test("the shadow exemption: a black-alpha box-shadow, text-shadow and drop-shadow() pass", () => {
    const text = `.card {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08), 0 4px 12px #0000001f;
  text-shadow: 0 1px 0 rgb(0 0 0 / 0.3);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}`;
    expect(checkContract({ stylesheets: [sheet(text)] })).toEqual([]);
  });

  test("an allow entry is reported as allowed, not as a violation", () => {
    const text = ".print {\n  color: black;\n}\n.x { background: white; }";
    const result = checkContract({ stylesheets: [sheet(text)], allow: ["color:   black"] });
    expect(result).toEqual([
      { path: "app.css", line: 2, rule: 3, detail: expect.stringContaining("black"), allowed: true },
      { path: "app.css", line: 4, rule: 3, detail: expect.stringContaining("white"), allowed: false },
    ]);
    expect(violations(result)).toHaveLength(1);
  });

  test("inline SVG style text without a selector is checked too", () => {
    const result = checkContract({ stylesheets: [sheet("fill: #fff; stroke: var(--fg)", "icon.svg#style")] });
    expect(result.map((r) => [r.path, r.rule])).toEqual([["icon.svg#style", 3]]);
  });
});

describe("rule 4: the Token map", () => {
  const map = `:root {
  --kind-a: var(--series-1);
  --kind-b: var(--series-2);
  --status-on: var(--state-active);
}`;

  test("a map that maps each data Token at most once passes, and its names count as declared", () => {
    const result = checkContract({ stylesheets: [sheet(".x { color: var(--kind-a); }")], tokenMap: map });
    expect(result).toEqual([]);
  });

  test("mapping a --series-* twice fails", () => {
    const twice = `${map.slice(0, -2)}\n  --kind-c: var(--series-1);\n}`;
    const result = checkContract({ stylesheets: [], tokenMap: twice });
    expect(result).toEqual([{ path: "token map", line: 5, rule: 4, detail: expect.stringContaining("--series-1"), allowed: false }]);
  });

  test("mapping a --state-* twice or another contract Token fails", () => {
    const bad = ":root {\n  --a: var(--state-quiet);\n  --b: var(--state-quiet);\n  --c: var(--bg);\n}";
    const result = checkContract({ stylesheets: [], tokenMap: bad });
    expect(result.map((r) => [r.line, r.rule])).toEqual([
      [3, 4],
      [4, 4],
    ]);
  });
});

test("comments are ignored and line numbers survive them", () => {
  const text = "/* color: red;\n   still a comment */\n.x {\n  color: #000;\n}";
  expect(checkContract({ stylesheets: [sheet(text)] })).toEqual([{ path: "app.css", line: 4, rule: 3, detail: expect.any(String), allowed: false }]);
});
