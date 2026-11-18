// Each expressive Theme carries exactly the values its design fixes: the Token table, the manifest, the display
// face and the files its directory holds. The generic tests (shape, manifest, contrast, provenance) check the
// rules over every Theme; this file checks that a Theme is the one that was designed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseSheet } from "../scripts/lib/assets.mjs";
import { parseStylesheet } from "../scripts/lib/css.mjs";
import { themes } from "./helpers.mjs";

const glow = (blur, spread, alpha) =>
  `0 0 calc(var(--intensity) * ${blur}px) calc(var(--intensity) * ${spread}px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * ${alpha}%)), transparent)`;
const glowSvg = (blur, alpha) =>
  `drop-shadow(0 0 calc(var(--intensity) * ${blur}px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * ${alpha}%)), transparent))`;
const gradient = (alpha) =>
  `linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * ${alpha}%)), var(--accent)))`;

const DESIGNS = {
  neon: {
    manifest: {
      id: "neon",
      label: "Neon",
      schemes: ["dark"],
      intensity: true,
      assets: { backdrop: { fallback: "backdrop.svg" }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      dark: {
        "--bg": "#0a0d1f", "--bg-raised": "#10152e", "--bg-sunken": "#070914",
        "--fg": "#e8f3ff", "--muted": "#8c9bc4", "--border": "#27306a",
        "--accent": "#ff2bd6", "--accent-fg": "#0a0d1f", "--selected": "#2a1250",
        "--series-1": "#00e5ff", "--series-2": "#3dff9a", "--series-3": "#ff8f3d",
        "--state-active": "#00e5ff", "--state-quiet": "#8c9bc4", "--state-attention": "#ffd23d",
        "--state-success": "#3dff9a", "--state-failure": "#ff3d6e", "--state-halted": "#b36bff",
        "--danger": "#ff3d6e", "--warning-bg": "#2a1a05", "--warning-fg": "#ffd23d",
        "--radius": "4px",
        "--font-display": '"Rajdhani", var(--font-sans)',
        "--theme-second": "#00e5ff",
        "--glow": glow(28, 2, 130),
        "--glow-svg": glowSvg(14, 160),
        "--accent-gradient": gradient(160),
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.6))",
      },
    },
    face: { family: '"Rajdhani"', file: "rajdhani-600.woff2", weight: "500 700" },
    files: [
      "OFL.txt", "backdrop.svg", "empty.svg", "ornament.svg", "prompts/backdrop.md", "prompts/empty.md",
      "prompts/ornament.md", "rajdhani-600.woff2", "theme.css", "theme.json",
    ],
  },
  circuit: {
    manifest: {
      id: "circuit",
      label: "Circuit",
      schemes: ["dark"],
      intensity: true,
      assets: { backdrop: { fallback: "backdrop.svg" }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      dark: {
        "--bg": "#060a09", "--bg-raised": "#0b1411", "--bg-sunken": "#030605",
        "--fg": "#d7f5e9", "--muted": "#7fae9a", "--border": "#164237",
        "--accent": "#19f0a8", "--accent-fg": "#03110c", "--selected": "#0f3a2c",
        "--series-1": "#19f0a8", "--series-2": "#5fd4ff", "--series-3": "#f5a524",
        "--state-active": "#5fd4ff", "--state-quiet": "#7fae9a", "--state-attention": "#f5a524",
        "--state-success": "#19f0a8", "--state-failure": "#ff5c5c", "--state-halted": "#b39dff",
        "--danger": "#ff5c5c", "--warning-bg": "#2a1e05", "--warning-fg": "#f5c660",
        "--radius": "2px",
        "--font-sans": '"Exo 2", system-ui, -apple-system, sans-serif',
        "--font-display": "var(--font-sans)",
        "--theme-second": "#5fd4ff",
        // circuit's glow has no spread: a fixed 0, not a calc.
        "--glow": "0 0 calc(var(--intensity) * 16px) 0 color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 100%)), transparent)",
        "--glow-svg": glowSvg(10, 120),
        "--accent-gradient": gradient(120),
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.4))",
      },
    },
    face: { family: '"Exo 2"', file: "exo2-variable.woff2", weight: "100 900" },
    files: [
      "OFL.txt", "backdrop.svg", "empty.svg", "exo2-variable.woff2", "ornament.svg", "prompts/backdrop.md",
      "prompts/empty.md", "prompts/ornament.md", "theme.css", "theme.json",
    ],
  },
  psychedelic: {
    manifest: {
      id: "psychedelic",
      label: "Psychedelic",
      schemes: ["dark"],
      intensity: true,
      assets: { backdrop: { fallback: "backdrop.svg" }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      dark: {
        "--bg": "#1b0a2e", "--bg-raised": "rgba(255, 255, 255, 0.08)", "--bg-sunken": "rgba(0, 0, 0, 0.25)",
        "--fg": "#fff4e6", "--muted": "#d4b4f5", "--border": "rgba(255, 255, 255, 0.18)",
        "--accent": "#ff6f3c", "--accent-fg": "#1b0a2e", "--selected": "rgba(255, 111, 60, 0.25)",
        "--series-1": "#c084fc", "--series-2": "#fde047", "--series-3": "#fb7185",
        "--state-active": "#60a5fa", "--state-quiet": "#c9bdd6", "--state-attention": "#fbbf24",
        "--state-success": "#4ade80", "--state-failure": "#fb7185", "--state-halted": "#c084fc",
        "--danger": "#fb7185", "--warning-bg": "rgba(251, 191, 36, 0.18)", "--warning-fg": "#fde68a",
        "--radius": "14px",
        "--font-display": '"Righteous", var(--font-sans)',
        "--theme-second": "#fde047",
        "--theme-third": "#c084fc",
        "--glow": glow(40, 4, 150),
        "--glow-svg": glowSvg(18, 180),
        // psychedelic's gradient runs through three colours at 100deg, the loudest of the expressive Themes.
        "--accent-gradient":
          "linear-gradient(100deg, var(--accent) 0%, color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 200%)), var(--accent)) 50%, color-mix(in srgb, var(--theme-third) min(100%, calc(var(--intensity) * 200%)), var(--accent)) 100%)",
        "--asset-opacity": "min(1, calc(var(--intensity) * 2))",
      },
    },
    face: { family: '"Righteous"', file: "righteous-400.woff2", weight: "400 700" },
    files: [
      "OFL.txt", "backdrop.svg", "empty.svg", "ornament.svg", "prompts/backdrop.md", "prompts/empty.md",
      "prompts/ornament.md", "righteous-400.woff2", "theme.css", "theme.json",
    ],
  },
};

const norm = (v) => v.replace(/\s+/g, " ").replace(/'/g, '"').trim();

/** The custom properties a Theme declares for one Scheme: the base block, then the Scheme's block over it. */
function declared(theme, scheme) {
  const { blocks } = parseStylesheet(theme.css);
  const out = {};
  for (const prelude of [`html[data-theme="${theme.id}"]`, `html[data-theme="${theme.id}"][data-scheme="${scheme}"]`])
    for (const b of blocks.filter((b) => norm(b.prelude) === prelude))
      for (const d of b.declarations) if (d.property.startsWith("--")) out[d.property] = norm(d.value);
  return out;
}

const designed = Object.entries(DESIGNS).map(([id, design]) => [id, design, themes.find((t) => t.id === id)]);

describe.each(designed)("the %s Theme", (id, design, theme) => {
  test("exists", () => {
    expect(theme, `themes/${id}/`).toBeDefined();
  });

  test("has the manifest of its design", () => {
    expect(theme.manifest).toEqual(design.manifest);
  });

  test.each(Object.keys(design.tokens))("declares the Token values of its design on %s", (scheme) => {
    const want = Object.fromEntries(Object.entries(design.tokens[scheme]).map(([k, v]) => [k, norm(v)]));
    const got = declared(theme, scheme);
    for (const [name, value] of Object.entries(want)) expect(got[name], name).toBe(value);
  });

  test("declares its display face once, from its own file, swapping, over its weight range", () => {
    const faces = parseStylesheet(theme.css).blocks.filter((b) => b.prelude === "@font-face");
    expect(faces).toHaveLength(1);
    const props = Object.fromEntries(faces[0].declarations.map((d) => [d.property, norm(d.value)]));
    expect(props).toMatchObject({
      "font-family": design.face.family,
      src: `url(/themes/${id}/${design.face.file}) format("woff2")`,
      "font-display": "swap",
      "font-weight": design.face.weight,
    });
  });

  test("holds its fallbacks, Prompt sheets, face and licence, and no raster", () => {
    expect([...theme.files].sort()).toEqual([...design.files].sort());
  });

  test("has a Prompt sheet for every asset its manifest declares", () => {
    const sheets = theme.files
      .filter((f) => f.startsWith("prompts/"))
      .map((f) => parseSheet(readFileSync(join(theme.path, f), "utf8"), f.slice("prompts/".length)));
    expect(sheets.map((s) => s.slot).sort()).toEqual(Object.keys(design.manifest.assets).sort());
  });

  test("has fallbacks that carry their own colours and name the Tokens they mirror", () => {
    for (const slot of Object.keys(design.manifest.assets)) {
      const svg = readFileSync(join(theme.path, `${slot}.svg`), "utf8");
      expect(svg, `${slot}.svg`).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      // An XML comment cannot hold "--", so a fallback names a Token without its leading dashes.
      const comments = [...svg.matchAll(/<!--([^]*?)-->/g)].map((m) => m[1]);
      expect(comments.join(" "), `${slot}.svg`).toMatch(/\bTokens\b[^]*\b(?:bg|accent|theme-second)\b/);
      for (const c of comments) expect(c, `${slot}.svg comment`).not.toContain("--");
      expect(svg, `${slot}.svg`).toMatch(/#[0-9a-f]{6}/i);
      expect(svg, `${slot}.svg`).not.toMatch(/var\(|url\((?!#)|<image|<script|<text/);
    }
  });
});
