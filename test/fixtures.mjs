// A synthetic registry for the chooser, boot script and React tests: two Schemes with per-Scheme assets,
// one Scheme with a single asset, and `default` first with none.
export const themes = [
  { id: "default", label: "Default", schemes: ["light", "dark"], intensity: false, assets: {} },
  {
    id: "dunes",
    label: "Dunes",
    schemes: ["light", "dark"],
    intensity: true,
    assets: {
      backdrop: { light: { fallback: "backdrop.light.svg", image: "backdrop.light.webp" }, dark: { fallback: "backdrop.dark.svg" } },
      ornament: { fallback: "ornament.svg", image: "ornament.png" },
    },
  },
  { id: "night", label: "Night", schemes: ["dark"], intensity: true, assets: { empty: { fallback: "empty.svg" } } },
];

export const registry = {
  themes,
  options: () =>
    themes.flatMap((t) =>
      t.schemes.length === 1
        ? [{ theme: t.id, scheme: t.schemes[0], label: t.label }]
        : ["auto", "light", "dark"].map((scheme) => ({ theme: t.id, scheme, label: `${t.label} · ${scheme}` })),
    ),
};

/** A `matchMedia` stand-in for `(prefers-color-scheme: dark)` whose answer a test flips. */
export function fakeMatchMedia(dark = false) {
  const listeners = new Set();
  const mql = {
    get matches() {
      return dark;
    },
    media: "(prefers-color-scheme: dark)",
    addEventListener: (type, fn) => type === "change" && listeners.add(fn),
    removeEventListener: (type, fn) => type === "change" && listeners.delete(fn),
  };
  const matchMedia = () => mql;
  matchMedia.flip = (next) => {
    dark = next;
    for (const fn of [...listeners]) fn({ matches: dark, media: mql.media });
  };
  matchMedia.listeners = listeners;
  return matchMedia;
}

/** An in-memory Storage. */
export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    data,
  };
}

/** A Storage whose every method throws, as a browser does with storage disabled. */
export const throwingStorage = {
  getItem() {
    throw new Error("storage disabled");
  },
  setItem() {
    throw new Error("storage disabled");
  },
  removeItem() {
    throw new Error("storage disabled");
  },
};
