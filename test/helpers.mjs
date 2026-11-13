// Shared loaders for the library's tests: the contract, the Slot vocabulary and every Theme directory.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadThemes } from "../scripts/lib/registry.mjs";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const contract = JSON.parse(readFileSync(join(root, "tokens.json"), "utf8"));
export const slots = JSON.parse(readFileSync(join(root, "slots.json"), "utf8"));
export const themes = loadThemes(root);
