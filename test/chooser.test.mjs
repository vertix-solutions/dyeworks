// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createChooser } from "../dist/chooser.js";
import { fakeMatchMedia, memoryStorage, registry, throwingStorage } from "./fixtures.mjs";

const KEY = "app.theme";
const MIRROR = "app.theme.default";
const html = document.documentElement;
let storage;
let media;
let chooser;

function setup({ stored, dark = false, ...options } = {}) {
  storage = memoryStorage(stored === undefined ? {} : { [KEY]: typeof stored === "string" ? stored : JSON.stringify(stored) });
  media = fakeMatchMedia(dark);
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("matchMedia", media);
  chooser = createChooser({ storageKey: KEY, registry, ...options });
  return chooser;
}

const written = () => ({
  theme: html.getAttribute("data-theme"),
  scheme: html.getAttribute("data-scheme"),
  intensity: html.style.getPropertyValue("--intensity"),
  backdrop: html.style.getPropertyValue("--asset-backdrop"),
  ornament: html.style.getPropertyValue("--asset-ornament"),
  empty: html.style.getPropertyValue("--asset-empty"),
});

beforeEach(() => {
  html.removeAttribute("data-theme");
  html.removeAttribute("data-scheme");
  html.removeAttribute("style");
});
afterEach(() => {
  chooser?.destroy();
  chooser = null;
  vi.unstubAllGlobals();
});

describe("resolution of the stored object", () => {
  test.each([
    ["nothing stored", undefined, { theme: "default", scheme: "auto", intensity: 0.5 }],
    ["a full valid choice", { theme: "dunes", scheme: "dark", intensity: 0.8 }, { theme: "dunes", scheme: "dark", intensity: 0.8 }],
    ["an unknown id", { theme: "vanished", scheme: "dark", intensity: 0.2 }, { theme: "default", scheme: "dark", intensity: 0.2 }],
    ["text that is not JSON", "{not json", { theme: "default", scheme: "auto", intensity: 0.5 }],
    ["JSON that is not an object", "[1,2]", { theme: "default", scheme: "auto", intensity: 0.5 }],
    ["JSON null", "null", { theme: "default", scheme: "auto", intensity: 0.5 }],
    ["a number", "42", { theme: "default", scheme: "auto", intensity: 0.5 }],
    ["fields of the wrong type", { theme: 7, scheme: true, intensity: "0.9" }, { theme: "default", scheme: "auto", intensity: 0.5 }],
    ["an unknown scheme", { theme: "dunes", scheme: "sepia", intensity: 1 }, { theme: "dunes", scheme: "auto", intensity: 1 }],
    ["intensity out of range", { theme: "dunes", scheme: "light", intensity: 1.5 }, { theme: "dunes", scheme: "light", intensity: 0.5 }],
    ["intensity negative", { theme: "dunes", scheme: "light", intensity: -0.1 }, { theme: "dunes", scheme: "light", intensity: 0.5 }],
    ["intensity not finite", '{"theme":"dunes","intensity":1e999}', { theme: "dunes", scheme: "auto", intensity: 0.5 }],
    ["missing fields", { theme: "dunes" }, { theme: "dunes", scheme: "auto", intensity: 0.5 }],
    ["intensity at the edges", { theme: "dunes", intensity: 0 }, { theme: "dunes", scheme: "auto", intensity: 0 }],
  ])("%s", (_name, stored, expected) => {
    setup({ stored });
    expect(chooser.get()).toEqual(expected);
  });

  test("auto resolves to the OS preference where the Theme declares both Schemes", () => {
    setup({ stored: { theme: "dunes", scheme: "auto", intensity: 0.5 }, dark: true });
    expect(chooser.resolved()).toEqual({ theme: "dunes", scheme: "dark", intensity: 0.5 });
    chooser.destroy();
    setup({ stored: { theme: "dunes", scheme: "auto", intensity: 0.5 }, dark: false });
    expect(chooser.resolved()).toEqual({ theme: "dunes", scheme: "light", intensity: 0.5 });
  });

  test("a single-Scheme Theme resolves to its Scheme whatever is stored", () => {
    for (const scheme of ["auto", "light", "dark"]) {
      setup({ stored: { theme: "night", scheme, intensity: 0.3 }, dark: false });
      expect(chooser.resolved().scheme).toBe("dark");
      chooser.destroy();
    }
  });

  test("an explicit Scheme wins over the OS preference", () => {
    setup({ stored: { theme: "dunes", scheme: "light" }, dark: true });
    expect(chooser.resolved().scheme).toBe("light");
  });
});

describe("what the chooser writes on <html>", () => {
  test("the attributes, --intensity and the per-Scheme asset Tokens", () => {
    setup({ stored: { theme: "dunes", scheme: "light", intensity: 0.75 } });
    expect(written()).toEqual({
      theme: "dunes",
      scheme: "light",
      intensity: "0.75",
      backdrop: "url(/themes/dunes/backdrop.light.webp)",
      ornament: "url(/themes/dunes/ornament.png)",
      empty: "none",
    });
  });

  test("the fallback where the resolved Scheme declares no image", () => {
    setup({ stored: { theme: "dunes", scheme: "dark" } });
    expect(written().backdrop).toBe("url(/themes/dunes/backdrop.dark.svg)");
    setup({ stored: { theme: "night" } });
    expect(written()).toMatchObject({ theme: "night", scheme: "dark", backdrop: "none", ornament: "none", empty: "url(/themes/night/empty.svg)" });
  });

  test("default with nothing stored: no assets", () => {
    setup();
    expect(written()).toEqual({ theme: "default", scheme: "light", intensity: "0.5", backdrop: "none", ornament: "none", empty: "none" });
  });
});

describe("the matchMedia listener", () => {
  test("re-resolves data-scheme and the asset Tokens while auto is in force", () => {
    setup({ stored: { theme: "dunes", scheme: "auto" }, dark: false });
    const seen = [];
    chooser.subscribe((resolved) => seen.push(resolved.scheme));
    expect(written()).toMatchObject({ scheme: "light", backdrop: "url(/themes/dunes/backdrop.light.webp)" });
    media.flip(true);
    expect(written()).toMatchObject({ scheme: "dark", backdrop: "url(/themes/dunes/backdrop.dark.svg)" });
    expect(chooser.resolved().scheme).toBe("dark");
    media.flip(false);
    expect(written()).toMatchObject({ scheme: "light", backdrop: "url(/themes/dunes/backdrop.light.webp)" });
    expect(seen).toEqual(["dark", "light"]);
  });

  test("leaves an explicit Scheme alone", () => {
    setup({ stored: { theme: "dunes", scheme: "light" }, dark: false });
    media.flip(true);
    expect(written().scheme).toBe("light");
  });

  test("destroy removes the listener and the subscribers", () => {
    setup({ stored: { theme: "dunes", scheme: "auto" } });
    const fn = vi.fn();
    chooser.subscribe(fn);
    chooser.destroy();
    expect(media.listeners.size).toBe(0);
    media.flip(true);
    expect(fn).not.toHaveBeenCalled();
    expect(written().scheme).toBe("light");
  });
});

describe("set, subscribe and storage", () => {
  test("set merges, validates against the registry, writes storage, applies and notifies", () => {
    setup();
    const fn = vi.fn();
    const unsubscribe = chooser.subscribe(fn);
    chooser.set({ theme: "dunes", scheme: "dark" });
    expect(chooser.get()).toEqual({ theme: "dunes", scheme: "dark", intensity: 0.5 });
    expect(JSON.parse(storage.getItem(KEY))).toEqual({ theme: "dunes", scheme: "dark", intensity: 0.5 });
    expect(written()).toMatchObject({ theme: "dunes", scheme: "dark" });
    expect(fn).toHaveBeenLastCalledWith({ theme: "dunes", scheme: "dark", intensity: 0.5 }, { theme: "dunes", scheme: "dark", intensity: 0.5 });
    chooser.set({ intensity: 0.25 });
    expect(written().intensity).toBe("0.25");
    chooser.set({ theme: "nowhere", intensity: 9 });
    expect(chooser.get()).toEqual({ theme: "default", scheme: "dark", intensity: 0.5 });
    unsubscribe();
    chooser.set({ intensity: 1 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("storage unavailable: reading and writing fail quietly and the choice still applies", () => {
    vi.stubGlobal("localStorage", throwingStorage);
    vi.stubGlobal("matchMedia", fakeMatchMedia(true));
    chooser = createChooser({ storageKey: KEY, registry, defaults: { theme: "dunes" }, mirrorKey: MIRROR });
    expect(chooser.get()).toEqual({ theme: "dunes", scheme: "auto", intensity: 0.5 });
    expect(() => chooser.set({ theme: "night" })).not.toThrow();
    expect(written()).toMatchObject({ theme: "night", scheme: "dark" });
  });

  test("storage whose very access throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    try {
      vi.stubGlobal("matchMedia", fakeMatchMedia(false));
      chooser = createChooser({ storageKey: KEY, registry });
      chooser.set({ theme: "dunes" });
      expect(written().theme).toBe("dunes");
    } finally {
      delete globalThis.localStorage;
    }
  });

  test("no matchMedia: auto resolves to light", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("matchMedia", undefined);
    chooser = createChooser({ storageKey: KEY, registry });
    expect(chooser.resolved().scheme).toBe("light");
  });
});

describe("defaults and the mirror", () => {
  test("defaults apply when storage holds nothing and are mirrored into mirrorKey", () => {
    setup({ defaults: { theme: "dunes", scheme: "dark", intensity: 0.9 }, mirrorKey: MIRROR });
    expect(chooser.get()).toEqual({ theme: "dunes", scheme: "dark", intensity: 0.9 });
    expect(JSON.parse(storage.getItem(MIRROR))).toEqual({ theme: "dunes", scheme: "dark", intensity: 0.9 });
    expect(storage.getItem(KEY)).toBeNull();
    expect(written().theme).toBe("dunes");
  });

  test("an explicit choice wins over defaults, which are still mirrored", () => {
    setup({ stored: { theme: "night", scheme: "dark", intensity: 0.1 }, defaults: { theme: "dunes" }, mirrorKey: MIRROR });
    expect(chooser.get()).toEqual({ theme: "night", scheme: "dark", intensity: 0.1 });
    expect(JSON.parse(storage.getItem(MIRROR))).toEqual({ theme: "dunes", scheme: "auto", intensity: 0.5 });
  });

  test("a choice made after defaults applied wins from then on", () => {
    setup({ defaults: { theme: "dunes" }, mirrorKey: MIRROR });
    chooser.set({ theme: "night" });
    chooser.destroy();
    chooser = createChooser({ storageKey: KEY, registry, defaults: { theme: "dunes" }, mirrorKey: MIRROR });
    expect(chooser.get().theme).toBe("night");
  });

  test("without defaults, the mirror serves when storage holds nothing", () => {
    storage = memoryStorage({ [MIRROR]: JSON.stringify({ theme: "dunes", scheme: "light", intensity: 0.4 }) });
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("matchMedia", fakeMatchMedia(false));
    chooser = createChooser({ storageKey: KEY, registry, mirrorKey: MIRROR });
    expect(chooser.get()).toEqual({ theme: "dunes", scheme: "light", intensity: 0.4 });
  });

  test("malformed defaults read as default, auto, 0.5", () => {
    setup({ defaults: { theme: 3, scheme: "noon", intensity: "x" } });
    expect(chooser.get()).toEqual({ theme: "default", scheme: "auto", intensity: 0.5 });
  });
});
