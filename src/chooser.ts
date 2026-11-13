// `dyeworks/chooser`: the framework-agnostic chooser. It keeps the stored object under the consumer's storage
// key, resolves it against the registry and writes the result on `<html>`.
import type { Scheme, ThemeEntry, ThemeOption } from "./registry.js";
import { applyResolution, resolveChoice, type Resolution, type Stored } from "./internal/resolve.js";

export type { Stored };

export interface Resolved {
  theme: string;
  scheme: Scheme;
  intensity: number;
}

export interface Registry {
  themes: ThemeEntry[];
  options(): ThemeOption[];
}

export interface ChooserOptions {
  /** The consumer's storage key for the stored object. */
  storageKey: string;
  /** The generated registry module (`import * as registry from "dyeworks/registry"`). */
  registry: Registry;
  /** The consumer's server default, applied when storage holds nothing. */
  defaults?: Partial<Stored>;
  /** Where the default is copied so the boot script can apply it on the next load. */
  mirrorKey?: string;
}

export type Listener = (resolved: Resolved, stored: Stored) => void;

export interface Chooser {
  get(): Stored;
  set(partial: Partial<Stored>): void;
  resolved(): Resolved;
  subscribe(fn: Listener): () => void;
  destroy(): void;
  /** The registry the chooser was created with, so a menu needs nothing but the chooser. */
  readonly registry: Registry;
}

const QUERY = "(prefers-color-scheme: dark)";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function storage(): StorageLike | null {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Storage unavailable: the choice still applies for this page.
  }
}

interface MediaQueryLike {
  matches: boolean;
  addEventListener?(type: "change", fn: () => void): void;
  removeEventListener?(type: "change", fn: () => void): void;
}

function media(): MediaQueryLike | null {
  try {
    const mm = (globalThis as { matchMedia?: (q: string) => MediaQueryLike }).matchMedia;
    return typeof mm === "function" ? mm(QUERY) : null;
  } catch {
    return null;
  }
}

export function createChooser({ storageKey, registry, defaults, mirrorKey }: ChooserOptions): Chooser {
  const themes = registry.themes;
  const mql = media();
  const prefersDark = () => {
    try {
      return !!mql?.matches;
    } catch {
      return false;
    }
  };
  const listeners = new Set<Listener>();

  let raw: unknown = read(storageKey);
  if (defaults !== undefined) {
    const normalised = resolveChoice(themes, defaults, false).stored;
    if (mirrorKey !== undefined) write(mirrorKey, JSON.stringify(normalised));
    if (raw === null) raw = normalised;
  } else if (raw === null && mirrorKey !== undefined) {
    raw = read(mirrorKey);
  }
  let current: Resolution = resolveChoice(themes, raw, prefersDark());

  const resolvedOf = (r: Resolution): Resolved => ({ theme: r.theme, scheme: r.scheme, intensity: r.intensity });
  const apply = () => {
    if (typeof document !== "undefined") applyResolution(document.documentElement, current);
  };
  const notify = () => {
    const resolved = resolvedOf(current);
    for (const fn of [...listeners]) fn(resolved, { ...current.stored });
  };
  const onChange = () => {
    const theme = themes.find((t) => t.id === current.theme);
    if (current.stored.scheme !== "auto" || !theme || theme.schemes.length < 2) return;
    current = resolveChoice(themes, current.stored, prefersDark());
    apply();
    notify();
  };

  mql?.addEventListener?.("change", onChange);
  apply();

  return {
    registry,
    get: () => ({ ...current.stored }),
    resolved: () => resolvedOf(current),
    set(partial) {
      current = resolveChoice(themes, { ...current.stored, ...partial }, prefersDark());
      write(storageKey, JSON.stringify(current.stored));
      apply();
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    destroy() {
      mql?.removeEventListener?.("change", onChange);
      listeners.clear();
    },
  };
}
