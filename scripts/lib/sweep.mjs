// The library's Sweep: it finds and never edits. Two layers over the tracked tree:
// - the generic rules, always on, needing no secret and no knowledge of the publisher;
// - the private strings, from a file outside the repository named by DYEWORKS_SWEEP_PRIVATE,
//   matched case-insensitively as text and as `sha256:` digests.
// The patterns are written so that this file does not match them itself.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

/** The files git tracks under `root`, plus those it would track (untracked and not ignored); null without git. */
export function trackedFiles(root) {
  try {
    const out = execFileSync("git", ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
    return [...new Set(out.split("\0").filter(Boolean))].filter((p) => existsSync(join(root, p)));
  } catch {
    return null;
  }
}

/** The repository's own hosting URL as `host/owner/repo`, from `origin`, or null. */
export function hostingPath(root) {
  try {
    return normaliseHostingUrl(execFileSync("git", ["-C", root, "remote", "get-url", "origin"], { encoding: "utf8" }));
  } catch {
    return null;
  }
}

export function normaliseHostingUrl(url) {
  const u = url.trim().replace(/^git\+/, "");
  let m = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+?)(?:\.git)?\/?$/.exec(u);
  if (!m) m = /^[^@/]+@([^:/]+):(.+?)(?:\.git)?\/?$/.exec(u);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** The file's text, or null for a binary (a NUL byte in the first 8 KiB, or not UTF-8). */
export function readText(file) {
  const data = readFileSync(file);
  if (data.subarray(0, 8192).includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return null;
  }
}

const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;
const excerpt = (s) => (s.length <= 60 ? s : `${s.slice(0, 57)}...`);

// --- the generic rules ---------------------------------------------------------------------------------

const HOME_PATH = /(?<![A-Za-z0-9._~/-])\/(Users|home)\/([A-Za-z0-9._-][^\s/"'`<>()[\]{},;:*\\]*)/g;
const PLACEHOLDERS = new Set(["Shared", "operator"]);
const KEY_SHAPES = [
  ["anthropic", /(?<![A-Za-z0-9_-])sk-ant-[A-Za-z0-9_-]+/g],
  ["sk", /(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}/g],
  ["github", /(?<![A-Za-z0-9_])ghp_[A-Za-z0-9]+/g],
  ["github_pat", /(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9_]+/g],
  ["npm", /(?<![A-Za-z0-9_])npm_[A-Za-z0-9]{36}/g],
  ["aws", /AKIA[0-9A-Z]{16}/g],
  ["pem", /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g],
];
const EMAIL = /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g;
const EMAIL_RESERVED_TLD = ".invalid";
const RASTER_AND_FONT = new Set([".png", ".webp", ".jpg", ".jpeg", ".gif", ".woff", ".woff2", ".ttf", ".otf"]);
const JUNK = new Set([".DS_Store", ".env", "node_modules", "dist", "test-results", "playwright-report", "screenshots"]);

// Colour literals live in the Themes and the contract only; the tests' synthetic palettes are exempt.
const COLOUR_HOMES = ["themes/", "tokens.json", "test/"];
const COLOUR_FILES = new Set([".css", ".html", ".svg", ".js", ".mjs", ".ts", ".tsx", ".json", ".yml", ".yaml"]);
const HEX = /(?<![A-Za-z0-9_&#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9A-Za-z_-])/g;
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*[-\d.]/gi;
const NAMED_COLOUR =
  /(?:^|[\s{;"'])(?:color|background(?:-color)?|fill|stroke|border(?:-[a-z]+)*|outline(?:-color)?|text-decoration(?:-color)?|accent-color|caret-color)\s*:\s*[^;}"']*?\b(black|white|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|maroon|navy|teal|olive|lime|aqua|cyan|magenta|fuchsia|gold|indigo|violet|brown|coral|crimson)\b/gi;

export function homePathFindings(path, text) {
  return [...text.matchAll(HOME_PATH)]
    .filter((m) => !PLACEHOLDERS.has(m[2]))
    .map((m) => ({ rule: "home_path", path, detail: `line ${lineOf(text, m.index)}: ${excerpt(m[0])}` }));
}

export function keyFindings(path, text) {
  return KEY_SHAPES.flatMap(([name, re]) =>
    [...text.matchAll(re)].map((m) => ({ rule: `key_shape:${name}`, path, detail: `line ${lineOf(text, m.index)}: ${m[0].slice(0, 12)}…` })),
  );
}

export function emailFindings(path, text) {
  if (path === "LICENSE") return [];
  return [...text.matchAll(EMAIL)]
    .filter((m) => !m[0].toLowerCase().endsWith(EMAIL_RESERVED_TLD))
    .map((m) => ({ rule: "email", path, detail: `line ${lineOf(text, m.index)}: ${m[0]}` }));
}

export function colourFindings(path, text) {
  if (COLOUR_HOMES.some((h) => (h.endsWith("/") ? path.startsWith(h) : path === h))) return [];
  const ext = extname(path).toLowerCase();
  if (!COLOUR_FILES.has(ext) || path === "package-lock.json") return [];
  const found = [...text.matchAll(HEX), ...text.matchAll(COLOUR_FUNCTION)];
  if ([".css", ".html", ".svg"].includes(ext)) found.push(...text.matchAll(NAMED_COLOUR));
  return found.map((m) => ({ rule: "colour_literal", path, detail: `line ${lineOf(text, m.index)}: ${excerpt(m[0].trim())}` }));
}

export function nameFindings(path) {
  const found = [];
  if (RASTER_AND_FONT.has(extname(path).toLowerCase()) && !path.startsWith("themes/"))
    found.push({ rule: "raster_or_font", path, detail: "a raster or font file outside themes/" });
  if (path.split("/").some((part) => JUNK.has(part)))
    found.push({ rule: "tracked_junk", path, detail: "a file that never belongs in the tree" });
  return found;
}

export function licenceFindings(root, paths) {
  const found = [];
  const licence = join(root, "LICENSE");
  if (!paths.includes("LICENSE") || !existsSync(licence)) found.push({ rule: "licence", path: "LICENSE", detail: "missing" });
  else if (!readFileSync(licence, "utf8").startsWith("MIT License"))
    found.push({ rule: "licence", path: "LICENSE", detail: "does not begin `MIT License`" });
  const pkg = existsSync(join(root, "package.json")) ? JSON.parse(readFileSync(join(root, "package.json"), "utf8")) : {};
  if (pkg.license !== "MIT") found.push({ rule: "licence", path: "package.json", detail: 'no `"license": "MIT"`' });
  return found;
}

const textOf = (root, path) => {
  const file = join(root, path);
  if (!existsSync(file)) return null;
  const st = lstatSync(file);
  return st.isFile() && !st.isSymbolicLink() ? readText(file) : null;
};

export function sweepGeneric(root, paths) {
  const found = [];
  for (const path of paths) {
    found.push(...nameFindings(path));
    const text = textOf(root, path);
    if (text === null) continue;
    found.push(...homePathFindings(path, text), ...keyFindings(path, text), ...emailFindings(path, text), ...colourFindings(path, text));
  }
  found.push(...licenceFindings(root, paths));
  return found;
}

// --- the private strings -------------------------------------------------------------------------------

const DIGEST = /sha256:([0-9a-f]{64})/g;
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

/** The private file's strings, one per line. Throws when the file is missing or inside the repository. */
export function loadPrivate(file, root) {
  const abs = resolve(file);
  const rel = relative(resolve(root), abs);
  if (!rel.startsWith("..") && !rel.startsWith(sep) && rel !== abs) throw new Error("DYEWORKS_SWEEP_PRIVATE names a file inside the repository");
  if (!existsSync(abs)) throw new Error("DYEWORKS_SWEEP_PRIVATE names a file that does not exist");
  return readFileSync(abs, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
}

const maskHosting = (text, hosting) =>
  hosting ? text.replace(new RegExp(hosting.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => " ".repeat(m.length)) : text;

/** Findings say where and which line of the private file, never the string itself. */
export function sweepPrivate(root, paths, strings, hosting = null) {
  const lowered = strings.map((s, i) => [i, s.toLowerCase()]);
  const digests = new Map();
  strings.forEach((s, i) => {
    digests.set(sha256(s), i);
    digests.set(sha256(s.toLowerCase()), i);
  });
  const found = [];
  for (const path of paths) {
    for (const [i, s] of lowered)
      if (path.toLowerCase().includes(s)) found.push({ rule: "private_text", path, detail: `string #${i + 1} in the path` });
    const text = textOf(root, path);
    if (text === null) continue;
    const haystack = maskHosting(text, hosting).toLowerCase();
    for (const [i, s] of lowered) {
      const at = haystack.indexOf(s);
      if (at >= 0) found.push({ rule: "private_text", path, detail: `line ${lineOf(haystack, at)}: string #${i + 1}` });
    }
    for (const m of text.matchAll(DIGEST)) {
      const i = digests.get(m[1]);
      if (i !== undefined) found.push({ rule: "private_digest", path, detail: `line ${lineOf(text, m.index)}: digest of string #${i + 1}` });
    }
  }
  return found;
}
