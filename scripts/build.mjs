// Build the published files under dist/: tokens.css, themes.css, registry.js (with its types), tokens.js, the
// reference page, and the compiled modules (chooser, boot, contract-check, react).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadThemes,
  renderReference,
  renderRegistry,
  renderRegistryTypes,
  renderThemesCss,
  renderTokenNames,
  renderTokenNamesTypes,
  renderTokensCss,
} from "./lib/registry.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The files generated from the Theme directories, the contract and the Slot vocabulary under `root`. */
export function build(root, out = join(root, "dist")) {
  const contract = JSON.parse(readFileSync(join(root, "tokens.json"), "utf8"));
  const slots = JSON.parse(readFileSync(join(root, "slots.json"), "utf8"));
  const themes = loadThemes(root);
  mkdirSync(out, { recursive: true });
  const files = {
    "tokens.css": renderTokensCss(contract),
    "themes.css": renderThemesCss(themes),
    "registry.js": renderRegistry(themes),
    "registry.d.ts": renderRegistryTypes(),
    "tokens.js": renderTokenNames(contract),
    "tokens.d.ts": renderTokenNamesTypes(),
    "reference.html": renderReference(contract, slots),
  };
  for (const [name, text] of Object.entries(files)) writeFileSync(join(out, name), text);
  return Object.keys(files).map((name) => join(out, name));
}

/** Compile the library's TypeScript sources (`src/`) into `out` with the package's own `tsc`. */
export function compile(out = join(packageRoot, "dist")) {
  const tsc = join(packageRoot, "node_modules", "typescript", "bin", "tsc");
  execFileSync(process.execPath, [tsc, "-p", join(packageRoot, "tsconfig.json"), "--outDir", out], { stdio: "inherit" });
}

/** The whole build of the package: a clean `dist/`, the generated files, then the compiled modules. */
export function buildAll(root = packageRoot) {
  const out = join(root, "dist");
  rmSync(out, { recursive: true, force: true });
  const written = build(root, out);
  compile(out);
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const path of buildAll(packageRoot)) console.log(`wrote ${path.slice(packageRoot.length + 1)}`);
  console.log("compiled src/ into dist/");
}
