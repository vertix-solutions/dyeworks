// The manifest rules of a Theme directory (theme.json).

const KEYS = ["id", "label", "schemes", "intensity", "assets"];
const SCHEMES = ["light", "dark"];
const ASSET_KEYS = ["backdrop", "ornament", "empty"];
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Check a manifest against the schema and the files of its directory.
 * @param {{dirName: string, manifest: object, files: string[]}} input
 * @returns {{rule: string, detail: string}[]}
 */
export function checkManifest({ dirName, manifest: m, files }) {
  const findings = [];
  const add = (rule, detail) => findings.push({ rule, detail });
  if (!isObject(m)) return [{ rule: "schema", detail: "theme.json is not an object" }];

  for (const key of Object.keys(m)) if (!KEYS.includes(key)) add("unknown_key", `"${key}" is not a manifest field`);

  if (typeof m.id !== "string" || !/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(m.id)) add("id", `id ${JSON.stringify(m.id)} is not snake_case`);
  else if (m.id !== dirName) add("id", `id "${m.id}" is not the directory name "${dirName}"`);

  if (typeof m.label !== "string" || m.label.trim() === "") add("label", "label must be non-empty text");

  const schemes = Array.isArray(m.schemes) ? m.schemes : null;
  if (!schemes || schemes.length === 0) add("schemes", "schemes must be a non-empty list");
  else {
    for (const s of schemes) if (!SCHEMES.includes(s)) add("schemes", `"${s}" is not a Scheme (light, dark)`);
    if (new Set(schemes).size !== schemes.length) add("schemes", "schemes repeats a Scheme");
  }

  if (typeof m.intensity !== "boolean") add("intensity", "intensity must be true or false");

  const named = [];
  const checkEntry = (where, entry, key, scheme) => {
    if (!isObject(entry)) return add("assets", `${where} must be an object`);
    for (const key of Object.keys(entry)) if (key !== "fallback" && key !== "image") add("assets", `${where} carries "${key}"`);
    if (typeof entry.fallback !== "string") add("assets", `${where} needs a fallback`);
    else if (!entry.fallback.endsWith(".svg")) add("assets", `${where}'s fallback "${entry.fallback}" is not an SVG`);
    else named.push(entry.fallback);
    for (const file of [entry.fallback, entry.image]) {
      if (typeof file !== "string") continue;
      const stem = file.replace(/\.[a-z0-9]+$/, "");
      if (stem !== key && stem !== `${key}.${scheme}`)
        add("assets", `${where}'s file "${file}" is not named ${key}${scheme ? `[.${scheme}]` : ""}.<ext>`);
    }
    if ("image" in entry) {
      if (typeof entry.image !== "string" || !/\.(png|webp)$/.test(entry.image)) add("assets", `${where}'s image ${JSON.stringify(entry.image)} is not png or webp`);
      else named.push(entry.image);
    }
  };

  if (!isObject(m.assets)) add("assets", "assets must be an object");
  else {
    for (const [key, value] of Object.entries(m.assets)) {
      if (!ASSET_KEYS.includes(key)) {
        add("assets", `"${key}" is not an asset key (${ASSET_KEYS.join(", ")})`);
        continue;
      }
      const perScheme = isObject(value) && !("fallback" in value) && !("image" in value);
      if (!perScheme) {
        checkEntry(key, value, key, null);
        continue;
      }
      for (const [scheme, entry] of Object.entries(value)) {
        if (!SCHEMES.includes(scheme)) add("per_scheme", `${key} names "${scheme}", which is not a Scheme`);
        else if (schemes && !schemes.includes(scheme)) add("per_scheme", `${key} names the undeclared Scheme "${scheme}"`);
        checkEntry(`${key}.${scheme}`, entry, key, scheme);
      }
      for (const scheme of schemes ?? []) if (!(scheme in value)) add("per_scheme", `${key} does not cover the declared Scheme "${scheme}"`);
    }
  }

  for (const file of named) if (!files.includes(file)) add("missing_file", `${file} is named but not in themes/${dirName}/`);
  return findings;
}
