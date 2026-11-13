// `dyeworks/contract-check`: a consumer runs this over its own stylesheets and inline SVG styles in its test
// suite. It finds and never edits.
import { tokenNames } from "./tokens.js";

export interface Stylesheet {
  path: string;
  text: string;
}

export interface CheckOptions {
  stylesheets: Stylesheet[];
  /** The consumer's Token map: the stylesheet text that gives the data Tokens its meanings. */
  tokenMap?: string;
  /** Declarations (`"property: value"`) the consumer vouches for; each is reported with `allowed: true`. */
  allow?: string[];
}

export interface Finding {
  path: string;
  line: number;
  rule: 1 | 2 | 3 | 4;
  detail: string;
  /** True for a declaration listed in `allow`: reported, not a violation. */
  allowed: boolean;
}

interface Declaration {
  property: string;
  value: string;
  line: number;
}

const CONTRACT = new Set<string>(tokenNames);
const INTENSITY = "--intensity";
const TOKEN_MAP_PATH = "token map";

/** Replace comments with spaces, keeping every newline so line numbers survive. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
}

const PROPERTY = /^(--[A-Za-z0-9_-]+|-?[A-Za-z][A-Za-z0-9-]*)$/;

/**
 * Every declaration in `text` at any depth (inside rules, at-rules and nested rules), and at the top level
 * for inline style text that has no selector.
 */
export function declarations(text: string): Declaration[] {
  const src = stripComments(text);
  const found: Declaration[] = [];
  let buf = "";
  let start: number | null = null;
  let line = 1;
  let paren = 0;
  let quote: string | null = null;
  const flush = () => {
    const t = buf.trim();
    const colon = t.indexOf(":");
    if (start !== null && colon > 0 && !t.startsWith("@")) {
      const property = t.slice(0, colon).trim();
      if (PROPERTY.test(property)) found.push({ property, value: t.slice(colon + 1).trim(), line: start });
    }
    buf = "";
    start = null;
  };
  for (const c of src) {
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(") paren++;
    else if (c === ")") paren = Math.max(0, paren - 1);
    else if (paren === 0 && c === "{") {
      buf = "";
      start = null;
      continue;
    } else if (paren === 0 && (c === ";" || c === "}")) {
      flush();
      continue;
    }
    if (c === "\n") line++;
    if (start === null && !/\s/.test(c)) start = line;
    buf += c;
  }
  flush();
  return found;
}

/** Every custom property a value reads through `var(--name…)`, fallbacks included. */
function reads(value: string): string[] {
  return [...value.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].map((m) => m[1]);
}

const COLOUR_PROPERTY = /^(color|background(-[a-z-]+)?|fill|stroke|border(-[a-z-]+)?|outline(-[a-z-]+)?|text-decoration(-[a-z-]+)?|accent-color)$/;
const HEX_LITERAL = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9A-Za-z_-])/;
const COLOUR_FUNCTION = /(?<![A-Za-z0-9_-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
// The CSS named colours. `transparent` and `currentcolor` are keywords that paint no hue of their own.
const NAMED = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood " +
    "cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray " +
    "darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
    "darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue " +
    "firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew " +
    "hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray " +
    "lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue " +
    "mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred " +
    "midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid " +
    "palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple " +
    "rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue " +
    "slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white " +
    "whitesmoke yellow yellowgreen"
  ).split(" "),
);

/** The colour literal in `value`, or null. `url()` and quoted strings are never read as colours. */
function colourLiteral(value: string): string | null {
  const bare = value.replace(/url\([^)]*\)/gi, " ").replace(/"[^"]*"|'[^']*'/g, " ");
  const hex = HEX_LITERAL.exec(bare);
  if (hex) return hex[0];
  const fn = COLOUR_FUNCTION.exec(bare);
  if (fn) return `${fn[1]}()`;
  for (const m of bare.matchAll(/(?<![A-Za-z0-9_-])([A-Za-z]+)(?![A-Za-z0-9_(-])/g)) {
    if (NAMED.has(m[1].toLowerCase())) return m[1];
  }
  return null;
}

const normalise = (declaration: string) => {
  const colon = declaration.indexOf(":");
  if (colon < 0) return declaration.trim().replace(/\s+/g, " ");
  return `${declaration.slice(0, colon).trim().toLowerCase()}: ${declaration.slice(colon + 1).trim().replace(/\s+/g, " ")}`;
};

/** Check the consumer's stylesheets against the four rules of the Token contract. */
export function checkContract({ stylesheets, tokenMap, allow = [] }: CheckOptions): Finding[] {
  const parsed = stylesheets.map((s) => ({ path: s.path, declarations: declarations(s.text) }));
  const mapDeclarations = tokenMap === undefined ? [] : declarations(tokenMap);
  const declared = new Set<string>();
  for (const d of [...parsed.flatMap((p) => p.declarations), ...mapDeclarations])
    if (d.property.startsWith("--") && !CONTRACT.has(d.property)) declared.add(d.property);
  const allowed = new Set(allow.map(normalise));
  const findings: Finding[] = [];

  for (const { path, declarations: decls } of parsed) {
    for (const d of decls) {
      const at = { path, line: d.line };
      // Rule 1: every read is a contract Token, --intensity, or declared by the consumer.
      for (const name of reads(d.value)) {
        if (!CONTRACT.has(name) && name !== INTENSITY && !declared.has(name))
          findings.push({ ...at, rule: 1, detail: `${d.property} reads ${name}, which is neither a contract Token nor declared in the stylesheets given`, allowed: false });
      }
      // Rule 2: a consumer maps, it never overrides.
      if (CONTRACT.has(d.property))
        findings.push({ ...at, rule: 2, detail: `sets the contract Token ${d.property}, which only a Theme file may set`, allowed: false });
      // Rule 3: no colour literal in a colour-bearing property; shadows are not among them.
      if (COLOUR_PROPERTY.test(d.property.toLowerCase())) {
        const literal = colourLiteral(d.value);
        if (literal !== null) {
          const declaration = `${d.property}: ${d.value}`;
          findings.push({ ...at, rule: 3, detail: `colour literal ${literal} in \`${declaration}\``, allowed: allowed.has(normalise(declaration)) });
        }
      }
    }
  }

  // Rule 4: each --series-* and --state-* mapped at most once, and nothing else of the contract mapped.
  const mapped = new Set<string>();
  for (const d of mapDeclarations) {
    for (const name of reads(d.value)) {
      if (!CONTRACT.has(name)) continue;
      const at = { path: TOKEN_MAP_PATH, line: d.line, rule: 4 as const, allowed: false };
      if (!/^--(series|state)-/.test(name)) findings.push({ ...at, detail: `${d.property} maps ${name}; the Token map maps only --series-* and --state-*` });
      else if (mapped.has(name)) findings.push({ ...at, detail: `${d.property} maps ${name} a second time` });
      mapped.add(name);
    }
  }
  return findings;
}
