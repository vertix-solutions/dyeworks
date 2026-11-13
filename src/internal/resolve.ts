// Resolution and application, shared by the chooser and the boot script. Both functions are self-contained
// (no imports, no outer names) because the boot script embeds their source text.
import type { Scheme } from "../registry.js";

/** What resolution needs of a Theme: the boot script embeds exactly these fields. */
export interface CompactTheme {
  id: string;
  schemes: Scheme[];
  assets: Record<string, unknown>;
}

/** The stored object, as the consumer's storage key holds it. */
export interface Stored {
  theme: string;
  scheme: "auto" | Scheme;
  intensity: number;
}

export interface Resolution {
  /** The stored object with every missing or malformed field read as `default`, `auto`, `0.5`. */
  stored: Stored;
  theme: string;
  scheme: Scheme;
  intensity: number;
  /** The three asset Tokens, as the inline custom properties written on `<html>`. */
  properties: Record<string, string>;
}

/**
 * Resolve `raw` (the stored text, or an object) against `themes`. An unknown id reads as `default`;
 * `auto` follows `prefersDark` where the Theme declares both Schemes; a single-Scheme Theme resolves to it.
 */
export function resolveChoice(themes: CompactTheme[], raw: unknown, prefersDark: boolean): Resolution {
  var value: any = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch (e) {
      value = null;
    }
  }
  var o: any = value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
  var theme: CompactTheme | undefined;
  for (var i = 0; i < themes.length; i++) if (themes[i].id === o.theme) theme = themes[i];
  if (!theme) for (var j = 0; j < themes.length; j++) if (themes[j].id === "default") theme = themes[j];
  if (!theme) theme = themes[0];
  var scheme: "auto" | Scheme = o.scheme === "light" || o.scheme === "dark" ? o.scheme : "auto";
  var intensity: number =
    typeof o.intensity === "number" && isFinite(o.intensity) && o.intensity >= 0 && o.intensity <= 1 ? o.intensity : 0.5;
  var resolved: Scheme =
    theme.schemes.length === 1 ? theme.schemes[0] : scheme === "auto" ? (prefersDark ? "dark" : "light") : scheme;
  var properties: Record<string, string> = { "--intensity": String(intensity) };
  var slots = ["backdrop", "ornament", "empty"];
  for (var k = 0; k < slots.length; k++) {
    var declared: any = theme.assets[slots[k]];
    var entry: any = declared ? (typeof declared.fallback === "string" ? declared : declared[resolved]) : null;
    properties["--asset-" + slots[k]] = entry ? "url(/themes/" + theme.id + "/" + (entry.image || entry.fallback) + ")" : "none";
  }
  return { stored: { theme: theme.id, scheme: scheme, intensity: intensity }, theme: theme.id, scheme: resolved, intensity: intensity, properties: properties };
}

/** Write a resolution on `<html>`: `data-theme`, `data-scheme`, `--intensity` and the asset Tokens. */
export function applyResolution(html: { setAttribute(n: string, v: string): void; style: { setProperty(n: string, v: string): void } }, r: Resolution): void {
  html.setAttribute("data-theme", r.theme);
  html.setAttribute("data-scheme", r.scheme);
  for (var name in r.properties) html.style.setProperty(name, r.properties[name]);
}
