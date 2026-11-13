// The types of the generated registry module (dist/registry.js); the build copies this file to dist/registry.d.ts.
export type Scheme = "light" | "dark";
export interface AssetEntry { fallback: string; image?: string }
export type Asset = AssetEntry | Partial<Record<Scheme, AssetEntry>>;
export interface ThemeEntry {
  id: string;
  label: string;
  schemes: Scheme[];
  intensity: boolean;
  assets: Partial<Record<"backdrop" | "ornament" | "empty", Asset>>;
}
export interface ThemeOption { theme: string; scheme: Scheme | "auto"; label: string }
export declare const themes: ThemeEntry[];
export declare function options(): ThemeOption[];
