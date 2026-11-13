// The contrast rules of ADR 0016 §7 over one Theme and Scheme, with translucent colours flattened.
import { parseStylesheet } from "./css.mjs";
import { contrastRatio, deltaE76, flatten, parseColor } from "./color.mjs";

const AA = 4.5;
const DELTA_E = 25;

/**
 * The value of every contract Token (and every --theme-* helper) for one Scheme of a Theme,
 * with every var() read substituted and --intensity set to `intensity`.
 */
export function resolveTokens({ contract, css, id, scheme, intensity }) {
  const raw = new Map(contract.tokens.map((t) => [t.name, t.default]));
  const { blocks } = parseStylesheet(css ?? "");
  const base = `html[data-theme="${id}"]`;
  const forScheme = `html[data-theme="${id}"][data-scheme="${scheme}"]`;
  const norm = (p) => p.replace(/'/g, '"');
  for (const target of [base, forScheme])
    for (const block of blocks)
      if (norm(block.prelude) === target)
        for (const d of block.declarations) if (d.property.startsWith("--")) raw.set(d.property, d.value);
  raw.set("--intensity", String(intensity));

  const resolved = new Map();
  const resolve = (name, seen = new Set()) => {
    if (resolved.has(name)) return resolved.get(name);
    if (seen.has(name) || !raw.has(name)) return undefined;
    seen.add(name);
    let value = raw.get(name);
    for (let guard = 0; guard < 32 && /var\(/.test(value); guard++) {
      value = value.replace(/var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*([^()]*))?\)/, (_m, ref, fallback) => resolve(ref, new Set(seen)) ?? fallback?.trim() ?? "");
    }
    resolved.set(name, value);
    return value;
  };
  const out = new Map();
  for (const name of raw.keys()) if (name !== "--intensity") out.set(name, resolve(name));
  return out;
}

/**
 * Check one Scheme's resolved Token values against the thresholds.
 * @returns {{rule: string, detail: string}[]}
 */
export function checkContrast(values, contract) {
  const findings = [];
  const colour = new Map();
  for (const t of contract.tokens) {
    if (t.type !== "color") continue;
    const c = parseColor(values.get(t.name));
    if (!c) findings.push({ rule: "unparsed", detail: `${t.name} "${values.get(t.name)}" is not a colour the test can evaluate` });
    else colour.set(t.name, c);
  }
  if (findings.length) return findings;

  const bg = colour.get("--bg");
  if (bg.a < 1) findings.push({ rule: "contrast", detail: "--bg must be opaque" });
  const surface = (name) => flatten(colour.get(name), bg); // a translucent surface measures as what it composites to
  const ratio = (fg, on) => contrastRatio(flatten(colour.get(fg), on), on);
  const need = (fg, onName, on) => {
    const r = ratio(fg, on);
    if (r < AA) findings.push({ rule: "contrast", detail: `${fg} on ${onName} is ${r.toFixed(2)}:1, under ${AA}:1` });
  };

  const names = contract.tokens.map((t) => t.name);
  const series = names.filter((n) => n.startsWith("--series-"));
  const states = names.filter((n) => n.startsWith("--state-"));
  const texts = ["--fg", "--muted", "--accent", "--danger", ...series, ...states];
  const surfaces = { "--bg": surface("--bg"), "--bg-raised": surface("--bg-raised") };
  for (const fg of texts) for (const [onName, on] of Object.entries(surfaces)) need(fg, onName, on);
  need("--accent-fg", "--accent", surface("--accent"));
  need("--warning-fg", "--warning-bg", surface("--warning-bg"));
  need("--fg", "--selected", surface("--selected"));

  for (const group of [series, states])
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        const d = deltaE76(surface(group[i]), surface(group[j]));
        if (d < DELTA_E) findings.push({ rule: "delta_e", detail: `${group[i]} and ${group[j]} differ by ΔE ${d.toFixed(1)}, under ${DELTA_E}` });
      }
  return findings;
}
