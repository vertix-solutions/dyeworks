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
  pylon: {
    manifest: {
      id: "pylon",
      label: "Pylon",
      schemes: ["light", "dark"],
      intensity: true,
      assets: {
        backdrop: { light: { fallback: "backdrop.light.svg" }, dark: { fallback: "backdrop.dark.svg" } },
        ornament: { fallback: "ornament.svg" },
        empty: { fallback: "empty.svg" },
      },
    },
    tokens: {
      // Day: sun-bleached sand, lapis crystals; its glow is a hard offset shadow with no blur.
      light: {
        "--bg": "#f7f1e4", "--bg-raised": "#efe6d3", "--bg-sunken": "#e6dcc6",
        "--fg": "#2b2316", "--muted": "#6e5d40", "--border": "#d8cbb0",
        "--accent": "#1860ad", "--accent-fg": "#ffffff", "--selected": "#d6e6f7",
        "--series-1": "#1860ad", "--series-2": "#1f6f52", "--series-3": "#a24f1b",
        "--state-active": "#1860ad", "--state-quiet": "#6e5d40", "--state-attention": "#805700",
        "--state-success": "#1f6f52", "--state-failure": "#b03227", "--state-halted": "#6447b0",
        "--danger": "#b03227", "--warning-bg": "#f3e4bd", "--warning-fg": "#6e4f08",
        "--radius": "6px",
        "--font-display": '"Forum", var(--font-sans)',
        "--theme-second": "#134e8c",
        "--glow": "calc(var(--intensity) * 2px) calc(var(--intensity) * 4px) 0 0 color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 90%)), transparent)",
        "--glow-svg": "drop-shadow(calc(var(--intensity) * 2px) calc(var(--intensity) * 4px) 0 color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 90%)), transparent))",
        "--accent-gradient": "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 120%)), var(--accent)))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.4))",
      },
      // Night: indigo dusk, cerulean crystals; a translucent raised surface and a glow between circuit's and neon's.
      dark: {
        "--bg": "#171224", "--bg-raised": "rgba(34, 26, 51, 0.88)", "--bg-sunken": "#110d1b",
        "--fg": "#f2e9d8", "--muted": "#a48f6e", "--border": "#3a2f4d",
        "--accent": "#4fc3ff", "--accent-fg": "#0b1620", "--selected": "#1d3550",
        "--series-1": "#4fc3ff", "--series-2": "#6fd3a6", "--series-3": "#e8945a",
        "--state-active": "#4fc3ff", "--state-quiet": "#a48f6e", "--state-attention": "#f0c050",
        "--state-success": "#6fd3a6", "--state-failure": "#ff6b6b", "--state-halted": "#b39dff",
        "--danger": "#ff6b6b", "--warning-bg": "#3a2a10", "--warning-fg": "#f0c050",
        "--radius": "6px",
        "--font-display": '"Forum", var(--font-sans)',
        "--theme-second": "#9fe0ff",
        "--glow": "0 0 calc(var(--intensity) * 18px) 0 color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 110%)), transparent)",
        "--glow-svg": glowSvg(10, 130),
        "--accent-gradient": "linear-gradient(180deg, color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 120%)), var(--accent)), var(--accent))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.6))",
      },
    },
    face: { family: '"Forum"', file: "forum-400.woff2", weight: "400 700" },
    files: [
      "OFL.txt", "backdrop.dark.svg", "backdrop.light.svg", "empty.svg", "forum-400.woff2", "ornament.svg",
      "prompts/backdrop.dark.md", "prompts/backdrop.light.md", "prompts/empty.md", "prompts/ornament.md",
      "theme.css", "theme.json",
    ],
  },
  aurora: {
    manifest: {
      id: "aurora",
      label: "Aurora",
      schemes: ["dark"],
      intensity: true,
      assets: { backdrop: { fallback: "backdrop.svg" }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      dark: {
        "--radius": "8px",
        "--font-display": "\"Lexend\", var(--font-sans)",
        "--theme-second": "#b28cff",
        "--glow": "0 0 calc(var(--intensity) * 32px) calc(var(--intensity) * 2px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 90%)), transparent)",
        "--glow-svg": "drop-shadow(0 0 calc(var(--intensity) * 14px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 120%)), transparent))",
        "--accent-gradient": "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 150%)), var(--accent)))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.6))",
        "--bg": "#0a1020",
        "--bg-raised": "#111a30",
        "--bg-sunken": "#070b17",
        "--fg": "#e8f1ff",
        "--muted": "#8d9cbc",
        "--border": "#24314f",
        "--accent": "#5cf2b4",
        "--accent-fg": "#06141a",
        "--selected": "#173a3a",
        "--series-1": "#5cf2b4",
        "--series-2": "#b28cff",
        "--series-3": "#ffb36b",
        "--state-active": "#5ccfff",
        "--state-quiet": "#8d9cbc",
        "--state-attention": "#ffd166",
        "--state-success": "#5cf2b4",
        "--state-failure": "#ff6b8a",
        "--state-halted": "#b28cff",
        "--danger": "#ff6b8a",
        "--warning-bg": "#2a2108",
        "--warning-fg": "#ffd166",
      },
    },
    face: { family: '"Lexend"', file: "lexend-500.woff2", weight: "400 700" },
    files: ["OFL.txt", "backdrop.svg", "empty.svg", "lexend-500.woff2", "ornament.svg", "prompts/backdrop.md", "prompts/empty.md", "prompts/ornament.md", "theme.css", "theme.json"],
  },
  blueprint: {
    manifest: {
      id: "blueprint",
      label: "Blueprint",
      schemes: ["dark"],
      intensity: true,
      assets: { backdrop: { fallback: "backdrop.svg" }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      dark: {
        "--radius": "2px",
        "--font-display": "\"IBM Plex Sans Condensed\", var(--font-sans)",
        "--theme-second": "#ffffff",
        "--glow": "0 0 calc(var(--intensity) * 6px) calc(var(--intensity) * 1px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 100%)), transparent)",
        "--glow-svg": "drop-shadow(0 0 calc(var(--intensity) * 4px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 120%)), transparent))",
        "--accent-gradient": "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 100%)), var(--accent)))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.4))",
        "--bg": "#0b2a4a",
        "--bg-raised": "#10345a",
        "--bg-sunken": "#08223d",
        "--fg": "#eef5ff",
        "--muted": "#a9c3e0",
        "--border": "#2f5a85",
        "--accent": "#9fe3ff",
        "--accent-fg": "#08223d",
        "--selected": "#1d4c7c",
        "--series-1": "#9fe3ff",
        "--series-2": "#ffd479",
        "--series-3": "#ff9fb2",
        "--state-active": "#9fe3ff",
        "--state-quiet": "#cfc6b8",
        "--state-attention": "#ffd479",
        "--state-success": "#8ff0b4",
        "--state-failure": "#ffa3a3",
        "--state-halted": "#d3b8ff",
        "--danger": "#ffa3a3",
        "--warning-bg": "#3a3215",
        "--warning-fg": "#ffd479",
      },
    },
    face: { family: '"IBM Plex Sans Condensed"', file: "ibm-plex-sans-condensed-600.woff2", weight: "400 700" },
    files: ["OFL.txt", "backdrop.svg", "empty.svg", "ibm-plex-sans-condensed-600.woff2", "ornament.svg", "prompts/backdrop.md", "prompts/empty.md", "prompts/ornament.md", "theme.css", "theme.json"],
  },
  contrast: {
    manifest: {
      id: "contrast",
      label: "Contrast",
      schemes: ["light", "dark"],
      intensity: false,
      assets: {},
    },
    tokens: {
      light: {
        "--radius": "4px",
        "--font-sans": "\"Atkinson Hyperlegible Next\", system-ui, -apple-system, sans-serif",
        "--glow": "none",
        "--glow-svg": "none",
        "--accent-gradient": "var(--accent)",
        "--font-display": "var(--font-sans)",
        "--asset-backdrop": "none",
        "--asset-ornament": "none",
        "--asset-empty": "none",
        "--asset-opacity": "1",
        "--bg": "#ffffff",
        "--bg-raised": "#f2f2f2",
        "--bg-sunken": "#e6e6e6",
        "--fg": "#000000",
        "--muted": "#333333",
        "--border": "#595959",
        "--accent": "#0033a0",
        "--accent-fg": "#ffffff",
        "--selected": "#cfe0ff",
        "--series-1": "#0033a0",
        "--series-2": "#005c26",
        "--series-3": "#9c2a00",
        "--state-active": "#0047b3",
        "--state-quiet": "#3d3d3d",
        "--state-attention": "#7a4100",
        "--state-success": "#005c26",
        "--state-failure": "#a80000",
        "--state-halted": "#5a1fa8",
        "--danger": "#a80000",
        "--warning-bg": "#fff1c2",
        "--warning-fg": "#4d2e00",
      },
      dark: {
        "--radius": "4px",
        "--font-sans": "\"Atkinson Hyperlegible Next\", system-ui, -apple-system, sans-serif",
        "--glow": "none",
        "--glow-svg": "none",
        "--accent-gradient": "var(--accent)",
        "--font-display": "var(--font-sans)",
        "--asset-backdrop": "none",
        "--asset-ornament": "none",
        "--asset-empty": "none",
        "--asset-opacity": "1",
        "--bg": "#000000",
        "--bg-raised": "#141414",
        "--bg-sunken": "#0a0a0a",
        "--fg": "#ffffff",
        "--muted": "#d0d0d0",
        "--border": "#a6a6a6",
        "--accent": "#ffd400",
        "--accent-fg": "#000000",
        "--selected": "#2b3a66",
        "--series-1": "#ffd400",
        "--series-2": "#66d9ff",
        "--series-3": "#ff8fa3",
        "--state-active": "#66b3ff",
        "--state-quiet": "#c8c8c8",
        "--state-attention": "#ffb000",
        "--state-success": "#5ee08a",
        "--state-failure": "#ff7a7a",
        "--state-halted": "#c9a6ff",
        "--danger": "#ff7a7a",
        "--warning-bg": "#332600",
        "--warning-fg": "#ffd966",
      },
    },
    face: { family: '"Atkinson Hyperlegible Next"', file: "atkinson-hyperlegible-next-variable.woff2", weight: "200 800" },
    files: ["OFL.txt", "atkinson-hyperlegible-next-variable.woff2", "theme.css", "theme.json"],
  },
  ember: {
    manifest: {
      id: "ember",
      label: "Ember",
      schemes: ["dark"],
      intensity: true,
      assets: { backdrop: { fallback: "backdrop.svg" }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      dark: {
        "--radius": "4px",
        "--font-display": "\"Chakra Petch\", var(--font-sans)",
        "--theme-second": "#ffcf5a",
        "--glow": "0 0 calc(var(--intensity) * 34px) calc(var(--intensity) * 3px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 140%)), transparent)",
        "--glow-svg": "drop-shadow(0 0 calc(var(--intensity) * 16px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 170%)), transparent))",
        "--accent-gradient": "linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 170%)), var(--accent)))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.8))",
        "--bg": "#14100e",
        "--bg-raised": "#1e1815",
        "--bg-sunken": "#0d0a09",
        "--fg": "#fbefe4",
        "--muted": "#b89c88",
        "--border": "#3d2e25",
        "--accent": "#ff7a1a",
        "--accent-fg": "#140a03",
        "--selected": "#4a2410",
        "--series-1": "#ff7a1a",
        "--series-2": "#ffcf5a",
        "--series-3": "#6fb7ff",
        "--state-active": "#6fb7ff",
        "--state-quiet": "#b39d8f",
        "--state-attention": "#ffcf5a",
        "--state-success": "#7fd48a",
        "--state-failure": "#ff5a52",
        "--state-halted": "#c9a0ff",
        "--danger": "#ff5a52",
        "--warning-bg": "#33230a",
        "--warning-fg": "#ffcf5a",
      },
    },
    face: { family: '"Chakra Petch"', file: "chakra-petch-600.woff2", weight: "400 700" },
    files: ["OFL.txt", "backdrop.svg", "chakra-petch-600.woff2", "empty.svg", "ornament.svg", "prompts/backdrop.md", "prompts/empty.md", "prompts/ornament.md", "theme.css", "theme.json"],
  },
  mint: {
    manifest: {
      id: "mint",
      label: "Mint",
      schemes: ["light"],
      intensity: true,
      assets: { backdrop: { fallback: "backdrop.svg" }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      light: {
        "--radius": "12px",
        "--font-display": "\"Nunito\", var(--font-sans)",
        "--theme-second": "#6fe3c1",
        "--glow": "0 calc(var(--intensity) * 6px) calc(var(--intensity) * 24px) 0 color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 150%)), transparent)",
        "--glow-svg": "drop-shadow(0 0 calc(var(--intensity) * 8px) color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 160%)), transparent))",
        "--accent-gradient": "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--theme-second) min(30%, calc(var(--intensity) * 60%)), var(--accent)))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.6))",
        "--bg": "#f4fbf8",
        "--bg-raised": "#e9f6f0",
        "--bg-sunken": "#dcefe6",
        "--fg": "#17302a",
        "--muted": "#4b665e",
        "--border": "#c7e2d6",
        "--accent": "#0f7a5a",
        "--accent-fg": "#ffffff",
        "--selected": "#cdeee0",
        "--series-1": "#0f7a5a",
        "--series-2": "#3559b8",
        "--series-3": "#b0491f",
        "--state-active": "#1f62b0",
        "--state-quiet": "#5a6370",
        "--state-attention": "#855600",
        "--state-success": "#13703f",
        "--state-failure": "#b8302f",
        "--state-halted": "#6a45b0",
        "--danger": "#b8302f",
        "--warning-bg": "#fbeccb",
        "--warning-fg": "#6b4a05",
      },
    },
    face: { family: '"Nunito"', file: "nunito-700.woff2", weight: "400 700" },
    files: ["OFL.txt", "backdrop.svg", "empty.svg", "nunito-700.woff2", "ornament.svg", "prompts/backdrop.md", "prompts/empty.md", "prompts/ornament.md", "theme.css", "theme.json"],
  },
  moss: {
    manifest: {
      id: "moss",
      label: "Moss",
      schemes: ["light", "dark"],
      intensity: true,
      assets: { backdrop: { light: { fallback: "backdrop.light.svg" }, dark: { fallback: "backdrop.dark.svg" } }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      light: {
        "--radius": "6px",
        "--font-display": "\"Bitter\", var(--font-sans)",
        "--bg": "#f3f5ee",
        "--bg-raised": "#e9ede1",
        "--bg-sunken": "#dfe4d4",
        "--fg": "#1f2619",
        "--muted": "#5a6450",
        "--border": "#cfd6c2",
        "--accent": "#3f6b2a",
        "--accent-fg": "#ffffff",
        "--selected": "#dbe8cc",
        "--series-1": "#3f6b2a",
        "--series-2": "#7a4a24",
        "--series-3": "#2e5e8c",
        "--state-active": "#2e5e8c",
        "--state-quiet": "#5a6450",
        "--state-attention": "#855c00",
        "--state-success": "#3f6b2a",
        "--state-failure": "#a8322a",
        "--state-halted": "#6c4aa0",
        "--danger": "#a8322a",
        "--warning-bg": "#f1e6c2",
        "--warning-fg": "#66480a",
        "--theme-second": "#7a4a24",
        "--glow": "0 calc(var(--intensity) * 3px) calc(var(--intensity) * 8px) 0 color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 70%)), transparent)",
        "--glow-svg": "drop-shadow(0 calc(var(--intensity) * 2px) calc(var(--intensity) * 4px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 90%)), transparent))",
        "--accent-gradient": "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 60%)), var(--accent)))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.4))",
      },
      dark: {
        "--radius": "6px",
        "--font-display": "\"Bitter\", var(--font-sans)",
        "--bg": "#12160f",
        "--bg-raised": "#1a2016",
        "--bg-sunken": "#0c0f0a",
        "--fg": "#e7eedd",
        "--muted": "#98a68a",
        "--border": "#2e3a26",
        "--accent": "#8fcf6a",
        "--accent-fg": "#10180b",
        "--selected": "#2a3f1f",
        "--series-1": "#8fcf6a",
        "--series-2": "#d9a36b",
        "--series-3": "#7fb8e6",
        "--state-active": "#7fb8e6",
        "--state-quiet": "#98a68a",
        "--state-attention": "#e8c35a",
        "--state-success": "#8fcf6a",
        "--state-failure": "#ff7f6e",
        "--state-halted": "#c0a0f0",
        "--danger": "#ff7f6e",
        "--warning-bg": "#2e2810",
        "--warning-fg": "#e8c35a",
        "--theme-second": "#d9a36b",
        "--glow": "0 0 calc(var(--intensity) * 14px) 0 color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 90%)), transparent)",
        "--glow-svg": "drop-shadow(0 0 calc(var(--intensity) * 8px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 110%)), transparent))",
        "--accent-gradient": "linear-gradient(180deg, color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 50%)), var(--accent)), var(--accent))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.6))",
      },
    },
    face: { family: '"Bitter"', file: "bitter-600.woff2", weight: "400 700" },
    files: ["OFL.txt", "backdrop.dark.svg", "backdrop.light.svg", "bitter-600.woff2", "empty.svg", "ornament.svg", "prompts/backdrop.dark.md", "prompts/backdrop.light.md", "prompts/empty.md", "prompts/ornament.md", "theme.css", "theme.json"],
  },
  noir: {
    manifest: {
      id: "noir",
      label: "Noir",
      schemes: ["dark"],
      intensity: true,
      assets: { backdrop: { fallback: "backdrop.svg" }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      dark: {
        "--radius": "0px",
        "--font-display": "\"Archivo Narrow\", var(--font-sans)",
        "--theme-second": "#8f1d22",
        "--glow": "calc(var(--intensity) * 3px) calc(var(--intensity) * 6px) 0 0 color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 100%)), transparent)",
        "--glow-svg": "drop-shadow(calc(var(--intensity) * 3px) calc(var(--intensity) * 6px) 0 color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 100%)), transparent))",
        "--accent-gradient": "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 100%)), var(--accent)))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.4))",
        "--bg": "#0b0b0b",
        "--bg-raised": "#151515",
        "--bg-sunken": "#060606",
        "--fg": "#efefea",
        "--muted": "#9a9a96",
        "--border": "#2e2e2e",
        "--accent": "#ff4d4f",
        "--accent-fg": "#0b0b0b",
        "--selected": "#3a1415",
        "--series-1": "#ff4d4f",
        "--series-2": "#c8c8c8",
        "--series-3": "#e0b050",
        "--state-active": "#8fb3d9",
        "--state-quiet": "#a3a3a0",
        "--state-attention": "#e0b050",
        "--state-success": "#8fc49a",
        "--state-failure": "#ff4d4f",
        "--state-halted": "#d8a0d0",
        "--danger": "#ff4d4f",
        "--warning-bg": "#2a2210",
        "--warning-fg": "#e0b050",
      },
    },
    face: { family: '"Archivo Narrow"', file: "archivo-narrow-700.woff2", weight: "400 700" },
    files: ["OFL.txt", "archivo-narrow-700.woff2", "backdrop.svg", "empty.svg", "ornament.svg", "prompts/backdrop.md", "prompts/empty.md", "prompts/ornament.md", "theme.css", "theme.json"],
  },
  paper: {
    manifest: {
      id: "paper",
      label: "Paper",
      schemes: ["light"],
      intensity: true,
      assets: { backdrop: { fallback: "backdrop.svg" }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      light: {
        "--radius": "3px",
        "--font-display": "\"Newsreader\", var(--font-sans)",
        "--theme-second": "#3d649e",
        "--glow": "calc(var(--intensity) * 2px) calc(var(--intensity) * 4px) 0 0 color-mix(in srgb, var(--fg) min(100%, calc(var(--intensity) * 50%)), transparent)",
        "--glow-svg": "drop-shadow(calc(var(--intensity) * 2px) calc(var(--intensity) * 4px) 0 color-mix(in srgb, var(--fg) min(100%, calc(var(--intensity) * 50%)), transparent))",
        "--accent-gradient": "linear-gradient(180deg, color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 60%)), var(--accent)), var(--accent))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.2))",
        "--bg": "#fbfaf7",
        "--bg-raised": "#f3f1ec",
        "--bg-sunken": "#eae7e0",
        "--fg": "#1d1c1a",
        "--muted": "#5e5a52",
        "--border": "#d9d5cc",
        "--accent": "#2b4c7e",
        "--accent-fg": "#ffffff",
        "--selected": "#dde5f1",
        "--series-1": "#2b4c7e",
        "--series-2": "#2f6b4f",
        "--series-3": "#9a4a1f",
        "--state-active": "#275a9a",
        "--state-quiet": "#5e5a52",
        "--state-attention": "#8a5a00",
        "--state-success": "#2f6b3a",
        "--state-failure": "#b0302a",
        "--state-halted": "#67449e",
        "--danger": "#b0302a",
        "--warning-bg": "#f4e8c8",
        "--warning-fg": "#6b4a05",
      },
    },
    face: { family: '"Newsreader"', file: "newsreader-600.woff2", weight: "400 700" },
    files: ["OFL.txt", "backdrop.svg", "empty.svg", "newsreader-600.woff2", "ornament.svg", "prompts/backdrop.md", "prompts/empty.md", "prompts/ornament.md", "theme.css", "theme.json"],
  },
  riso: {
    manifest: {
      id: "riso",
      label: "Riso",
      schemes: ["light"],
      intensity: true,
      assets: { backdrop: { fallback: "backdrop.svg" }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      light: {
        "--radius": "0px",
        "--font-display": "\"Archivo Black\", var(--font-sans)",
        "--theme-second": "#1f56c8",
        "--glow": "calc(var(--intensity) * 4px) calc(var(--intensity) * 3px) 0 0 color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 120%)), transparent)",
        "--glow-svg": "drop-shadow(calc(var(--intensity) * 4px) calc(var(--intensity) * 3px) 0 color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 120%)), transparent))",
        "--accent-gradient": "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--theme-second) min(40%, calc(var(--intensity) * 40%)), var(--accent)))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.4))",
        "--bg": "#f4f4ef",
        "--bg-raised": "#ebebe4",
        "--bg-sunken": "#e1e1d8",
        "--fg": "#161616",
        "--muted": "#55575c",
        "--border": "#d3d3c9",
        "--accent": "#c0185f",
        "--accent-fg": "#ffffff",
        "--selected": "#f7d3e3",
        "--series-1": "#c0185f",
        "--series-2": "#1f56c8",
        "--series-3": "#1d6e3e",
        "--state-active": "#1f56c8",
        "--state-quiet": "#5f6166",
        "--state-attention": "#9a5800",
        "--state-success": "#1d6e3e",
        "--state-failure": "#c4202a",
        "--state-halted": "#8a3398",
        "--danger": "#c4202a",
        "--warning-bg": "#f8e7b0",
        "--warning-fg": "#6a4700",
      },
    },
    face: { family: '"Archivo Black"', file: "archivo-black-400.woff2", weight: "400 700" },
    files: ["OFL.txt", "archivo-black-400.woff2", "backdrop.svg", "empty.svg", "ornament.svg", "prompts/backdrop.md", "prompts/empty.md", "prompts/ornament.md", "theme.css", "theme.json"],
  },
  sakura: {
    manifest: {
      id: "sakura",
      label: "Sakura",
      schemes: ["light", "dark"],
      intensity: true,
      assets: { backdrop: { light: { fallback: "backdrop.light.svg" }, dark: { fallback: "backdrop.dark.svg" } }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      light: {
        "--radius": "12px",
        "--font-display": "\"Zen Maru Gothic\", var(--font-sans)",
        "--bg": "#fdf6f8",
        "--bg-raised": "#f8ebf0",
        "--bg-sunken": "#f1dee6",
        "--fg": "#3a1d2c",
        "--muted": "#7a4a62",
        "--border": "#ead0dc",
        "--accent": "#a3336b",
        "--accent-fg": "#ffffff",
        "--selected": "#f6d6e5",
        "--series-1": "#a3336b",
        "--series-2": "#2f6f5e",
        "--series-3": "#8a5a12",
        "--state-active": "#2a5fa8",
        "--state-quiet": "#7a4a62",
        "--state-attention": "#8a5a00",
        "--state-success": "#2f6f4a",
        "--state-failure": "#b8233a",
        "--state-halted": "#6a45a8",
        "--danger": "#b8233a",
        "--warning-bg": "#f8e6c8",
        "--warning-fg": "#6e4a05",
        "--theme-second": "#c4467f",
        "--glow": "0 calc(var(--intensity) * 6px) calc(var(--intensity) * 22px) 0 color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 90%)), transparent)",
        "--glow-svg": "drop-shadow(0 0 calc(var(--intensity) * 8px) color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 120%)), transparent))",
        "--accent-gradient": "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 100%)), var(--accent)))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.4))",
      },
      dark: {
        "--radius": "12px",
        "--font-display": "\"Zen Maru Gothic\", var(--font-sans)",
        "--bg": "#1c1219",
        "--bg-raised": "#261a23",
        "--bg-sunken": "#150d13",
        "--fg": "#f8e8ef",
        "--muted": "#c497ad",
        "--border": "#3d2a37",
        "--accent": "#ff8fbf",
        "--accent-fg": "#2a0f1d",
        "--selected": "#4a2238",
        "--series-1": "#ff8fbf",
        "--series-2": "#7fd6a8",
        "--series-3": "#f2b45a",
        "--state-active": "#7cb8ff",
        "--state-quiet": "#b49aa8",
        "--state-attention": "#f2c14e",
        "--state-success": "#6fd39a",
        "--state-failure": "#ff6b7a",
        "--state-halted": "#b99cff",
        "--danger": "#ff6b7a",
        "--warning-bg": "#3a2810",
        "--warning-fg": "#f2c14e",
        "--theme-second": "#ffc2dc",
        "--glow": "0 0 calc(var(--intensity) * 22px) calc(var(--intensity) * 2px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 110%)), transparent)",
        "--glow-svg": "drop-shadow(0 0 calc(var(--intensity) * 12px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 140%)), transparent))",
        "--accent-gradient": "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 120%)), var(--accent)))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.6))",
      },
    },
    face: { family: '"Zen Maru Gothic"', file: "zen-maru-gothic-700.woff2", weight: "400 700" },
    files: ["OFL.txt", "backdrop.dark.svg", "backdrop.light.svg", "empty.svg", "ornament.svg", "prompts/backdrop.dark.md", "prompts/backdrop.light.md", "prompts/empty.md", "prompts/ornament.md", "theme.css", "theme.json", "zen-maru-gothic-700.woff2"],
  },
  slate: {
    manifest: {
      id: "slate",
      label: "Slate",
      schemes: ["light", "dark"],
      intensity: false,
      assets: {},
    },
    tokens: {
      light: {
        "--radius": "6px",
        "--font-sans": "\"Manrope\", system-ui, -apple-system, sans-serif",
        "--glow": "none",
        "--glow-svg": "none",
        "--accent-gradient": "var(--accent)",
        "--font-display": "var(--font-sans)",
        "--asset-backdrop": "none",
        "--asset-ornament": "none",
        "--asset-empty": "none",
        "--asset-opacity": "1",
        "--bg": "#f8fafc",
        "--bg-raised": "#f0f3f7",
        "--bg-sunken": "#e5e9ef",
        "--fg": "#141a22",
        "--muted": "#56606e",
        "--border": "#d5dbe3",
        "--accent": "#2f5fd0",
        "--accent-fg": "#ffffff",
        "--selected": "#e1e9fa",
        "--series-1": "#2f5fd0",
        "--series-2": "#1d7a5c",
        "--series-3": "#b5501c",
        "--state-active": "#2563b8",
        "--state-quiet": "#5a6472",
        "--state-attention": "#8f5200",
        "--state-success": "#1d7a3f",
        "--state-failure": "#c0322f",
        "--state-halted": "#6346c0",
        "--danger": "#c0322f",
        "--warning-bg": "#fdf0dc",
        "--warning-fg": "#7a4300",
      },
      dark: {
        "--radius": "6px",
        "--font-sans": "\"Manrope\", system-ui, -apple-system, sans-serif",
        "--glow": "none",
        "--glow-svg": "none",
        "--accent-gradient": "var(--accent)",
        "--font-display": "var(--font-sans)",
        "--asset-backdrop": "none",
        "--asset-ornament": "none",
        "--asset-empty": "none",
        "--asset-opacity": "1",
        "--bg": "#0f141b",
        "--bg-raised": "#161d26",
        "--bg-sunken": "#0a0e13",
        "--fg": "#e6ebf2",
        "--muted": "#95a1b2",
        "--border": "#2a3442",
        "--accent": "#7aa2ff",
        "--accent-fg": "#0b1220",
        "--selected": "#1f2f4f",
        "--series-1": "#7aa2ff",
        "--series-2": "#5fd0a0",
        "--series-3": "#f09a5a",
        "--state-active": "#6aa8ff",
        "--state-quiet": "#95a1b2",
        "--state-attention": "#f0c050",
        "--state-success": "#5fd07a",
        "--state-failure": "#ff7070",
        "--state-halted": "#b49aff",
        "--danger": "#ff7070",
        "--warning-bg": "#33270e",
        "--warning-fg": "#f0c050",
      },
    },
    face: { family: '"Manrope"', file: "manrope-variable.woff2", weight: "200 800" },
    files: ["OFL.txt", "manrope-variable.woff2", "theme.css", "theme.json"],
  },
  sunrise: {
    manifest: {
      id: "sunrise",
      label: "Sunrise",
      schemes: ["light"],
      intensity: true,
      assets: { backdrop: { fallback: "backdrop.svg" }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      light: {
        "--radius": "10px",
        "--font-display": "\"Sora\", var(--font-sans)",
        "--theme-second": "#e08a1c",
        "--glow": "0 calc(var(--intensity) * 8px) calc(var(--intensity) * 24px) 0 color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 90%)), transparent)",
        "--glow-svg": "drop-shadow(0 calc(var(--intensity) * 3px) calc(var(--intensity) * 8px) color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 110%)), transparent))",
        "--accent-gradient": "linear-gradient(120deg, color-mix(in srgb, var(--theme-second) min(60%, calc(var(--intensity) * 80%)), var(--accent)), var(--accent))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.6))",
        "--bg": "#fff8f2",
        "--bg-raised": "#fdeee2",
        "--bg-sunken": "#f7e3d3",
        "--fg": "#3b2216",
        "--muted": "#7a5240",
        "--border": "#efd6c3",
        "--accent": "#b83c25",
        "--accent-fg": "#ffffff",
        "--selected": "#fbdccb",
        "--series-1": "#b83c25",
        "--series-2": "#1f6a7a",
        "--series-3": "#7d6000",
        "--state-active": "#2860a8",
        "--state-quiet": "#7a5240",
        "--state-attention": "#8f5a00",
        "--state-success": "#2e6e3e",
        "--state-failure": "#b0202a",
        "--state-halted": "#6b45a5",
        "--danger": "#b0202a",
        "--warning-bg": "#fbe6b8",
        "--warning-fg": "#6e4800",
      },
    },
    face: { family: '"Sora"', file: "sora-600.woff2", weight: "400 700" },
    files: ["OFL.txt", "backdrop.svg", "empty.svg", "ornament.svg", "prompts/backdrop.md", "prompts/empty.md", "prompts/ornament.md", "sora-600.woff2", "theme.css", "theme.json"],
  },
  terminal: {
    manifest: {
      id: "terminal",
      label: "Terminal",
      schemes: ["dark"],
      intensity: true,
      assets: { backdrop: { fallback: "backdrop.svg" }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      dark: {
        "--radius": "0px",
        "--font-display": "\"JetBrains Mono\", var(--font-sans)",
        "--theme-second": "#ffb000",
        "--glow": "0 0 calc(var(--intensity) * 20px) calc(var(--intensity) * 1px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 110%)), transparent)",
        "--glow-svg": "drop-shadow(0 0 calc(var(--intensity) * 10px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 140%)), transparent))",
        "--accent-gradient": "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 110%)), var(--accent)))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.6))",
        "--bg": "#050a06",
        "--bg-raised": "#0a140c",
        "--bg-sunken": "#030603",
        "--fg": "#c8ffd4",
        "--muted": "#6fae80",
        "--border": "#1c3a22",
        "--accent": "#33ff77",
        "--accent-fg": "#031007",
        "--selected": "#103a1c",
        "--series-1": "#33ff77",
        "--series-2": "#ffb000",
        "--series-3": "#5ccfff",
        "--state-active": "#5ccfff",
        "--state-quiet": "#7fa58a",
        "--state-attention": "#ffb000",
        "--state-success": "#33ff77",
        "--state-failure": "#ff5c5c",
        "--state-halted": "#c79bff",
        "--danger": "#ff5c5c",
        "--warning-bg": "#2a1d02",
        "--warning-fg": "#ffc640",
      },
    },
    face: { family: '"JetBrains Mono"', file: "jetbrains-mono-600.woff2", weight: "400 700" },
    files: ["OFL.txt", "backdrop.svg", "empty.svg", "jetbrains-mono-600.woff2", "ornament.svg", "prompts/backdrop.md", "prompts/empty.md", "prompts/ornament.md", "theme.css", "theme.json"],
  },
  tidal: {
    manifest: {
      id: "tidal",
      label: "Tidal",
      schemes: ["light", "dark"],
      intensity: true,
      assets: { backdrop: { light: { fallback: "backdrop.light.svg" }, dark: { fallback: "backdrop.dark.svg" } }, ornament: { fallback: "ornament.svg" }, empty: { fallback: "empty.svg" } },
    },
    tokens: {
      light: {
        "--radius": "10px",
        "--font-display": "\"Outfit\", var(--font-sans)",
        "--bg": "#eef6f5",
        "--bg-raised": "#e2efed",
        "--bg-sunken": "#d5e7e4",
        "--fg": "#10282c",
        "--muted": "#4c6669",
        "--border": "#c2d9d6",
        "--accent": "#0b6e78",
        "--accent-fg": "#ffffff",
        "--selected": "#cde9ea",
        "--series-1": "#0b6e78",
        "--series-2": "#7a4fa8",
        "--series-3": "#a2531c",
        "--state-active": "#1660a8",
        "--state-quiet": "#4c6669",
        "--state-attention": "#8a5a00",
        "--state-success": "#1d7044",
        "--state-failure": "#b3303a",
        "--state-halted": "#7a4fa8",
        "--danger": "#b3303a",
        "--warning-bg": "#f4e7c4",
        "--warning-fg": "#6b4a05",
        "--theme-second": "#2aa8a0",
        "--glow": "0 calc(var(--intensity) * 6px) calc(var(--intensity) * 16px) 0 color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 70%)), transparent)",
        "--glow-svg": "drop-shadow(0 calc(var(--intensity) * 3px) calc(var(--intensity) * 6px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 90%)), transparent))",
        "--accent-gradient": "linear-gradient(180deg, color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 80%)), var(--accent)), var(--accent))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.4))",
      },
      dark: {
        "--radius": "10px",
        "--font-display": "\"Outfit\", var(--font-sans)",
        "--bg": "#0a1a22",
        "--bg-raised": "#10242e",
        "--bg-sunken": "#071319",
        "--fg": "#e2f4f3",
        "--muted": "#86a6ab",
        "--border": "#21404a",
        "--accent": "#4fd1c5",
        "--accent-fg": "#061a1c",
        "--selected": "#134049",
        "--series-1": "#4fd1c5",
        "--series-2": "#c3a0ff",
        "--series-3": "#f2a65a",
        "--state-active": "#5cb8ff",
        "--state-quiet": "#86a6ab",
        "--state-attention": "#f2c94c",
        "--state-success": "#6fdc8c",
        "--state-failure": "#ff7a7a",
        "--state-halted": "#c3a0ff",
        "--danger": "#ff7a7a",
        "--warning-bg": "#2c2410",
        "--warning-fg": "#f2c94c",
        "--theme-second": "#9cf0e6",
        "--glow": "0 0 calc(var(--intensity) * 20px) 0 color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 100%)), transparent)",
        "--glow-svg": "drop-shadow(0 0 calc(var(--intensity) * 10px) color-mix(in srgb, var(--accent) min(100%, calc(var(--intensity) * 120%)), transparent))",
        "--accent-gradient": "linear-gradient(180deg, color-mix(in srgb, var(--theme-second) min(100%, calc(var(--intensity) * 120%)), var(--accent)), var(--accent))",
        "--asset-opacity": "min(1, calc(var(--intensity) * 1.6))",
      },
    },
    face: { family: '"Outfit"', file: "outfit-600.woff2", weight: "400 700" },
    files: ["OFL.txt", "backdrop.dark.svg", "backdrop.light.svg", "empty.svg", "ornament.svg", "outfit-600.woff2", "prompts/backdrop.dark.md", "prompts/backdrop.light.md", "prompts/empty.md", "prompts/ornament.md", "theme.css", "theme.json"],
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

/** Every asset a design declares, as `<slot>` when shared or `<slot>.<scheme>` per Scheme. */
const assetKeys = (design) =>
  Object.entries(design.manifest.assets).flatMap(([slot, entry]) =>
    "fallback" in entry ? [slot] : Object.keys(entry).map((scheme) => `${slot}.${scheme}`),
  );

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

  test("fills only --font-display with a static face, and --font-sans too only with a variable one", () => {
    const variable = /variable/.test(design.face.file);
    for (const scheme of Object.keys(design.tokens))
      expect("--font-sans" in declared(theme, scheme), `--font-sans on ${scheme}`).toBe(variable);
  });

  test("has a Prompt sheet for every asset its manifest declares, one per Scheme for a per-Scheme asset", () => {
    const sheets = theme.files
      .filter((f) => f.startsWith("prompts/"))
      .map((f) => parseSheet(readFileSync(join(theme.path, f), "utf8"), f.slice("prompts/".length)));
    expect(sheets.map((s) => (s.scheme ? `${s.slot}.${s.scheme}` : s.slot)).sort()).toEqual(assetKeys(design).sort());
  });

  test("has fallbacks that carry their own colours and name the Tokens they mirror", () => {
    for (const key of assetKeys(design)) {
      const svg = readFileSync(join(theme.path, `${key}.svg`), "utf8");
      expect(svg, `${key}.svg`).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      // An XML comment cannot hold "--", so a fallback names a Token without its leading dashes.
      const comments = [...svg.matchAll(/<!--([^]*?)-->/g)].map((m) => m[1]);
      expect(comments.join(" "), `${key}.svg`).toMatch(/\bTokens\b[^]*\b(?:bg|accent|theme-second)\b/);
      for (const c of comments) expect(c, `${key}.svg comment`).not.toContain("--");
      expect(svg, `${key}.svg`).toMatch(/#[0-9a-f]{6}/i);
      expect(svg, `${key}.svg`).not.toMatch(/var\(|url\((?!#)|<image|<script|<text/);
    }
  });
});

// pylon's backdrops are viewport-fixed covers under content that may have no opaque surface of its own, and a
// consumer's content reaches close to every edge (a full-width page padded 24 CSS px). No strip of the frame stays
// clear of content at every viewport, since the cover's scale follows the viewport and the padding does not. So a
// fallback holds its field, its dunes and, at night, its haze, and no other shape anywhere in the frame: no
// crystal, ground shadow or pool of light (spec 07 §5).
describe.each(["light", "dark"])("pylon's %s backdrop", (scheme) => {
  const svg = readFileSync(join(themes.find((t) => t.id === "pylon").path, `backdrop.${scheme}.svg`), "utf8");
  const body = svg.replace(/<!--[^]*?-->/g, "").replace(/<defs>[^]*?<\/defs>/g, "");
  const elements = [...body.matchAll(/<([a-zA-Z]+)\b([^>]*)>/g)].map((m) => ({ name: m[1], attrs: m[2] }));

  test("holds no crystal, shadow, pool or other shape", () => {
    for (const name of ["use", "ellipse", "circle", "polygon", "polyline", "line", "image", "g", "symbol"])
      expect(svg, `a <${name}>`).not.toMatch(new RegExp(`<${name}\\b`));
    expect(svg).not.toMatch(/id="crystal"/);
  });

  test("draws only its field, two dunes reaching the foot of the frame and, at night, the haze", () => {
    const rects = elements.filter((e) => e.name === "rect");
    const paths = elements.filter((e) => e.name === "path");
    const others = elements.filter((e) => !["svg", "rect", "path"].includes(e.name));
    expect(others.map((e) => e.name)).toEqual([]);
    for (const r of rects) {
      expect(r.attrs).toMatch(/\bwidth="1536"/);
      expect(r.attrs).toMatch(/\bheight="1024"/);
      expect(r.attrs).not.toMatch(/\b[xy]="/);
    }
    expect(rects.map((r) => /\bfill="([^"]+)"/.exec(r.attrs)[1])).toEqual(
      scheme === "light" ? ["#f7f1e4"] : ["#171224", "url(#haze)"],
    );
    expect(paths).toHaveLength(2);
    for (const d of paths) expect(d.attrs, "a dune runs edge to edge down to the foot").toMatch(/\bd="M0 [^"]*V1024H0Z"/);
    if (scheme === "dark") {
      const defs = /<defs>([^]*?)<\/defs>/.exec(svg)[1];
      expect([...defs.matchAll(/<(radialGradient|linearGradient)\b[^>]*\bid="([^"]+)"/g)].map((m) => m[2])).toEqual(["haze"]);
    }
  });
});

describe.each(["light", "dark"])("pylon's %s backdrop Prompt sheet", (scheme) => {
  const sheet = readFileSync(join(themes.find((t) => t.id === "pylon").path, `prompts/backdrop.${scheme}.md`), "utf8");
  const section = (name) => new RegExp(`^## ${name}\\n([^]*?)(?=^## |(?![^]))`, "m").exec(sheet)[1];

  test("asks for no object anywhere in the frame", () => {
    expect(section("Prompt")).not.toMatch(/crystal|shadow|pool/i);
    expect(section("Prompt")).toMatch(/no\s+object\s+anywhere\s+in\s+the\s+frame/i);
  });

  test("lists crystals, shadows and pools of light under Must not", () => {
    expect(section("Must not")).toMatch(/crystals,\s+shadows,\s+pools\s+of\s+light/);
  });
});
