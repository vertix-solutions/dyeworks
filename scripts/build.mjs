// Build the published files under dist/: tokens.css, themes.css, registry.js (with its types) and the reference page.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadThemes, renderReference, renderRegistry, renderRegistryTypes, renderThemesCss, renderTokensCss } from "./lib/registry.mjs";

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
    "reference.html": renderReference(contract, slots),
  };
  for (const [name, text] of Object.entries(files)) writeFileSync(join(out, name), text);
  return Object.keys(files).map((name) => join(out, name));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  for (const path of build(root)) console.log(`wrote ${path.slice(root.length + 1)}`);
}
