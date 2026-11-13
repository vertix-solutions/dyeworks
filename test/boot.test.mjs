import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";
import { bootScript } from "../dist/boot.js";
import { renderBootScript } from "../dist/internal/boot-text.js";
import { themes as builtThemes } from "../dist/registry.js";
import { fakeMatchMedia, memoryStorage, themes, throwingStorage } from "./fixtures.mjs";

const KEY = "app.theme";
const MIRROR = "app.theme.default";

/**
 * A simulated document at the moment the inline script runs: `<head>` holds no stylesheet yet. Every write
 * is logged with the number of stylesheets present when it happened.
 */
function simulatedDocument() {
  const log = [];
  const attributes = {};
  const properties = {};
  const document = {
    styleSheets: [],
    documentElement: {
      setAttribute(name, value) {
        attributes[name] = String(value);
        log.push({ write: name, sheets: document.styleSheets.length });
      },
      style: {
        setProperty(name, value) {
          properties[name] = String(value);
          log.push({ write: name, sheets: document.styleSheets.length });
        },
      },
    },
  };
  return { document, attributes, properties, log };
}

function run(text, { storage, dark = false, matchMedia = fakeMatchMedia(dark) }) {
  const sim = simulatedDocument();
  const context = { document: sim.document, matchMedia };
  Object.defineProperty(context, "localStorage", {
    get() {
      if (storage === "throws") throw new Error("SecurityError");
      return storage;
    },
  });
  runInNewContext(text, context);
  // A stylesheet arrives only after the inline script has run.
  sim.document.styleSheets.push({});
  return sim;
}

const script = (mirrorKey) => renderBootScript(themes, { storageKey: KEY, mirrorKey });

describe("the boot script", () => {
  test("applies a stored choice before any stylesheet", () => {
    const storage = memoryStorage({ [KEY]: JSON.stringify({ theme: "dunes", scheme: "auto", intensity: 0.7 }) });
    const { attributes, properties, log } = run(script(), { storage, dark: false });
    expect(attributes).toEqual({ "data-theme": "dunes", "data-scheme": "light" });
    expect(properties).toEqual({
      "--intensity": "0.7",
      "--asset-backdrop": "url(/themes/dunes/backdrop.light.webp)",
      "--asset-ornament": "url(/themes/dunes/ornament.png)",
      "--asset-empty": "none",
    });
    expect(log.length).toBe(6);
    expect(log.every((w) => w.sheets === 0)).toBe(true);
  });

  test("resolves auto from the OS preference and per-Scheme assets", () => {
    const storage = memoryStorage({ [KEY]: JSON.stringify({ theme: "dunes", scheme: "auto", intensity: 0.7 }) });
    const { attributes, properties } = run(script(), { storage, dark: true });
    expect(attributes["data-scheme"]).toBe("dark");
    expect(properties["--asset-backdrop"]).toBe("url(/themes/dunes/backdrop.dark.svg)");
  });

  test.each([
    ["text that is not JSON", "{oops"],
    ["an array", "[]"],
    ["fields of the wrong type", JSON.stringify({ theme: 1, scheme: 2, intensity: "3" })],
    ["an unknown id", JSON.stringify({ theme: "vanished", scheme: "nope", intensity: 4 })],
  ])("with corrupt storage (%s) it writes the defaults", (_name, raw) => {
    const { attributes, properties } = run(script(), { storage: memoryStorage({ [KEY]: raw }), dark: false });
    expect(attributes).toEqual({ "data-theme": "default", "data-scheme": "light" });
    expect(properties).toEqual({ "--intensity": "0.5", "--asset-backdrop": "none", "--asset-ornament": "none", "--asset-empty": "none" });
  });

  test("with nothing stored it reads the mirror", () => {
    const storage = memoryStorage({ [MIRROR]: JSON.stringify({ theme: "night", scheme: "auto", intensity: 1 }) });
    const { attributes, properties } = run(script(MIRROR), { storage });
    expect(attributes).toEqual({ "data-theme": "night", "data-scheme": "dark" });
    expect(properties["--asset-empty"]).toBe("url(/themes/night/empty.svg)");
    expect(properties["--intensity"]).toBe("1");
  });

  test("a stored choice wins over the mirror", () => {
    const storage = memoryStorage({ [KEY]: JSON.stringify({ theme: "dunes" }), [MIRROR]: JSON.stringify({ theme: "night" }) });
    expect(run(script(MIRROR), { storage }).attributes["data-theme"]).toBe("dunes");
  });

  test("with throwing storage it does nothing and throws nothing", () => {
    for (const storage of [throwingStorage, "throws", undefined]) {
      const { log } = run(script(MIRROR), { storage });
      expect(log).toEqual([]);
    }
  });

  test("without matchMedia, auto resolves to light", () => {
    const storage = memoryStorage({ [KEY]: JSON.stringify({ theme: "dunes" }) });
    expect(run(script(), { storage, matchMedia: undefined }).attributes["data-scheme"]).toBe("light");
  });

  test("keys are embedded as string literals and the text cannot close its <script>", () => {
    const text = renderBootScript([{ id: "x</script>", schemes: ["light"], assets: {} }], { storageKey: 'a"b</script>' });
    expect(text).not.toContain("</script>");
    const storage = memoryStorage({ 'a"b</script>': JSON.stringify({ theme: "x</script>" }) });
    expect(run(text, { storage }).attributes["data-theme"]).toBe("x</script>");
  });

  test("bootScript embeds the built registry compactly", () => {
    const text = bootScript({ storageKey: KEY });
    for (const t of builtThemes) expect(text).toContain(JSON.stringify(t.id));
    expect(text).not.toContain('"label"');
    const { attributes } = run(text, { storage: memoryStorage({ [KEY]: JSON.stringify({ theme: "default", scheme: "dark" }) }) });
    expect(attributes).toEqual({ "data-theme": "default", "data-scheme": "dark" });
  });
});
