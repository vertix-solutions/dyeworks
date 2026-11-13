// The shape rules of a Theme file (theme.css): Token declarations under the Theme's selectors, nothing else.
import { parseStylesheet } from "./css.mjs";

const CONSUMER_PREFIXES = ["--kind-", "--status-"];
const FONT_FACE_DESCRIPTORS = new Set(["font-family", "src", "font-display", "font-weight", "font-style", "font-stretch", "unicode-range"]);

/** The Scheme a selector addresses (`null` for the base block), or `undefined` when it is not a Theme selector. */
function selectorScheme(prelude, id) {
  const q = `["']`;
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`^html\\[data-theme=${q}${esc}${q}\\](?:\\[data-scheme=${q}([a-z]+)${q}\\])?$`).exec(prelude);
  return m ? (m[1] ?? null) : undefined;
}

/**
 * Check a Theme file against the shape rules.
 * @param {{id: string, css: string, manifest: {schemes: string[], intensity: boolean}, contract: {tokens: {name, tier, default}[]}}} input
 * @returns {{line: number, rule: string, detail: string}[]}
 */
export function checkThemeShape({ id, css, manifest, contract }) {
  const findings = [];
  const add = (line, rule, detail) => findings.push({ line, rule, detail });
  const tokens = new Map(contract.tokens.map((t) => [t.name, t]));
  const { blocks, statements, nested } = parseStylesheet(css);
  const schemes = new Set(manifest.schemes ?? []);
  const fontFaceSrc = new RegExp(`^url\\(\\s*["']?/themes/${id}/[a-z0-9_.-]+\\.woff2["']?\\s*\\)\\s+format\\(\\s*["']woff2["']\\s*\\)$`);
  const decorationSet = new Map(); // name -> [{value, line}]
  let fontFaces = 0;

  for (const s of statements) add(s.line, "at_rule", `"${s.prelude}" is not allowed in a Theme file`);
  for (const n of nested) add(n.line, "nesting", `a nested block ("${n.prelude}") is not allowed in a Theme file`);

  for (const block of blocks) {
    if (block.prelude.startsWith("@")) {
      if (block.prelude !== "@font-face") {
        add(block.line, "at_rule", `"${block.prelude}" is not allowed in a Theme file`);
        continue;
      }
      fontFaces++;
      if (fontFaces > 1) add(block.line, "font_face", "a Theme file declares at most one @font-face");
      const props = new Map(block.declarations.map((d) => [d.property, d]));
      for (const d of block.declarations) {
        if (!FONT_FACE_DESCRIPTORS.has(d.property)) add(d.line, "font_face", `"${d.property}" is not a font descriptor`);
      }
      const src = props.get("src");
      if (!src) add(block.line, "font_face", "@font-face needs a src");
      else if (!fontFaceSrc.test(src.value))
        add(src.line, "font_face", `src must be url(/themes/${id}/<file>.woff2) format("woff2"), not "${src.value}"`);
      const display = props.get("font-display");
      if (!display) add(block.line, "font_face", "@font-face needs font-display: swap");
      else if (display.value !== "swap") add(display.line, "font_face", `font-display must be swap, not "${display.value}"`);
      continue;
    }

    const scheme = selectorScheme(block.prelude, id);
    if (scheme === undefined) {
      add(block.line, "selector", `"${block.prelude}" is not html[data-theme="${id}"] or one of its Scheme selectors`);
      continue;
    }
    if (scheme !== null && !schemes.has(scheme))
      add(block.line, "scheme", `a block for the Scheme "${scheme}", which the manifest does not declare`);

    for (const d of block.declarations) {
      const p = d.property;
      if (/url\(/i.test(d.value)) add(d.line, "url", `url() appears outside @font-face in ${p}`);
      if (p === "color-scheme") {
        const allowed = scheme === null ? ["light", "dark", "light dark", "dark light"] : [scheme];
        if (!allowed.includes(d.value)) add(d.line, "scheme", `color-scheme "${d.value}" in the ${scheme ?? "base"} block`);
        continue;
      }
      if (CONSUMER_PREFIXES.some((x) => p.startsWith(x))) {
        add(d.line, "consumer_name", `${p} is a consumer's name; a Theme sets contract Tokens only`);
        continue;
      }
      if (p.startsWith("--theme-")) continue;
      const token = tokens.get(p);
      if (!token) {
        add(d.line, "property", p.startsWith("--") ? `${p} is not a contract Token or a --theme-* helper` : `"${p}" is not a Token declaration`);
        continue;
      }
      if (token.tier === "decoration") {
        if (!decorationSet.has(p)) decorationSet.set(p, []);
        decorationSet.get(p).push(d);
      }
    }
  }

  if (manifest.intensity === true) {
    for (const name of ["--glow", "--glow-svg"]) {
      const decls = decorationSet.get(name) ?? [];
      if (!decls.some((d) => /var\(\s*--intensity\b/.test(d.value)))
        add(decls[0]?.line ?? 1, "intensity", `${name} must read --intensity in a Theme declaring intensity: true`);
    }
  } else {
    for (const [name, decls] of decorationSet) {
      const def = tokens.get(name).default;
      for (const d of decls)
        if (d.value.replace(/\s+/g, " ") !== def)
          add(d.line, "intensity", `${name} must stay at the contract default "${def}" in a Theme declaring intensity: false`);
    }
  }

  return findings.sort((a, b) => a.line - b.line);
}
