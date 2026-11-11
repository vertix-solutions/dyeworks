// Colour maths for the contrast test: parsing, flattening, WCAG contrast and CIE76 ΔE.

/** Parse a hex or rgb()/rgba() colour into {r, g, b, a} (channels 0–255, alpha 0–1), or null. */
export function parseColor(text) {
  const s = String(text).trim().toLowerCase();
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  m = /^rgba?\((.*)\)$/.exec(s);
  if (!m) return null;
  const parts = m[1].includes(",") ? m[1].split(",") : m[1].replace("/", " / ").split(/\s+/).filter((p) => p && p !== "/");
  if (parts.length < 3 || parts.length > 4) return null;
  const channel = (p) => (p.trim().endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p));
  const alpha = (p) => (p === undefined ? 1 : p.trim().endsWith("%") ? parseFloat(p) / 100 : parseFloat(p));
  const c = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha(parts[3]) };
  return Object.values(c).every(Number.isFinite) ? c : null;
}

/** Composite `top` over `under` (which is made opaque first), giving an opaque colour. */
export function flatten(top, under) {
  const base = under.a < 1 ? flatten(under, { r: 255, g: 255, b: 255, a: 1 }) : under;
  const mix = (k) => top[k] * top.a + base[k] * (1 - top.a);
  return { r: mix("r"), g: mix("g"), b: mix("b"), a: 1 };
}

export function toHex({ r, g, b }) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

const linear = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance({ r, g, b }) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** The WCAG 2 contrast ratio of two opaque colours. */
export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** CIE L*a*b* (D65) of an opaque sRGB colour. */
export function toLab({ r, g, b }) {
  const [R, G, B] = [linear(r), linear(g), linear(b)];
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIE76 colour difference of two opaque colours. */
export function deltaE76(c1, c2) {
  const p = toLab(c1);
  const q = toLab(c2);
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}
