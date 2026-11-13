// The library's Sweep over its own tracked tree, and the rules' unit tests over synthetic trees.
// Every matching string below is assembled at run time so this file never matches the rules itself.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { hostingPath, loadPrivate, normaliseHostingUrl, sweepGeneric, sweepPrivate, trackedFiles } from "../scripts/lib/sweep.mjs";
import { root } from "./helpers.mjs";

const paths = trackedFiles(root);
const show = (found) => found.map((f) => `${f.path}: [${f.rule}] ${f.detail}`);

describe("the tracked tree", () => {
  test.skipIf(paths === null)("passes the generic rules", () => {
    expect(show(sweepGeneric(root, paths))).toEqual([]);
  });

  const privateFile = process.env.DYEWORKS_SWEEP_PRIVATE;
  test.skipIf(!privateFile || paths === null)("holds none of the private strings (DYEWORKS_SWEEP_PRIVATE)", () => {
    const strings = loadPrivate(privateFile, root);
    expect(show(sweepPrivate(root, paths, strings, hostingPath(root)))).toEqual([]);
  });
});

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tree = (files) => {
  const dir = mkdtempSync(join(tmpdir(), "dyeworks-sweep-"));
  dirs.push(dir);
  const all = { LICENSE: "MIT License\n", "package.json": '{"license": "MIT"}', ...files };
  for (const [name, content] of Object.entries(all)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return [dir, Object.keys(all)];
};
const rules = (files) => sweepGeneric(...tree(files)).map((f) => f.rule);

const home = "/" + "Users/" + "someone/projects";
const linuxHome = "/" + "home/" + "someone";
const email = "someone" + "@" + "example.com";
const hexColour = "#" + "ff00aa";

describe("the generic rules", () => {
  test("pass a clean tree", () => {
    expect(rules({ "README.md": "A theme library.\n" })).toEqual([]);
  });

  test.each([home, linuxHome])("find the home path %s", (p) => {
    expect(rules({ "notes.md": `see ${p}\n` })).toContain("home_path");
  });

  test("allow the placeholders", () => {
    expect(rules({ "notes.md": `${"/" + "Users/"}Shared/x and ${"/" + "Users/"}operator/x\n` })).toEqual([]);
  });

  test.each([
    ["anthropic", "sk-" + "ant-" + "abc123"],
    ["sk", "sk-" + "a".repeat(24)],
    ["github", "gh" + "p_" + "abc123"],
    ["github_pat", "github" + "_pat_" + "abc"],
    ["npm", "np" + "m_" + "A".repeat(36)],
    ["aws", "AK" + "IA" + "A".repeat(16)],
    ["pem", "-----BEGIN RSA " + "PRIVATE KEY-----"],
  ])("find a %s key shape", (name, key) => {
    expect(rules({ "x.txt": `token ${key}\n` })).toContain(`key_shape:${name}`);
  });

  test("find an email address but not a reserved one", () => {
    expect(rules({ "x.md": `${email}\n` })).toContain("email");
    expect(rules({ "x.md": `${"a" + "@" + "b.invalid"}\n` })).toEqual([]);
  });

  test("find a colour literal outside themes/ and tokens.json", () => {
    expect(rules({ "slots.css": `.x { color: ${hexColour}; }\n` })).toContain("colour_literal");
    expect(rules({ "demo/demo.js": `el.style.color = "${"rgb" + "(1, 2, 3)"}";\n` })).toContain("colour_literal");
    expect(rules({ "demo/index.html": `<p style="color: ${"re" + "d"}">x</p>\n` })).toContain("colour_literal");
  });

  test("allow colour literals in themes/ and tokens.json", () => {
    expect(rules({ "themes/sample/theme.css": `html[data-theme="sample"] { --bg: ${hexColour}; }\n`, "tokens.json": `{"default": "${hexColour}"}` })).toEqual([]);
  });

  test("find a raster or font outside themes/", () => {
    expect(rules({ "demo/shot.png": "x" })).toContain("raster_or_font");
    expect(rules({ "face.woff2": "x" })).toContain("raster_or_font");
    expect(rules({ "themes/sample/ornament.png": "x" })).toEqual([]);
  });

  test("find tracked junk", () => {
    expect(rules({ "dist/tokens.css": ":root {}\n" })).toContain("tracked_junk");
    expect(rules({ ".DS_Store": "x" })).toContain("tracked_junk");
  });

  test("ask for an MIT LICENSE and package.json", () => {
    expect(rules({ LICENSE: "Apache License\n" })).toContain("licence");
    expect(rules({ "package.json": '{"license": "ISC"}' })).toContain("licence");
  });
});

describe("the private strings", () => {
  test("are found in text and paths, case-insensitively, and named by line only", () => {
    const [dir, files] = tree({ "README.md": "Made by Example Corp.\n", "examplecorp/x.txt": "" });
    const found = sweepPrivate(dir, files, ["example corp", "ExampleCorp"]);
    expect(found).toContainEqual({ rule: "private_text", path: "README.md", detail: "line 1: string #1" });
    expect(found).toContainEqual({ rule: "private_text", path: "examplecorp/x.txt", detail: "string #2 in the path" });
    for (const f of found) expect(f.detail).not.toMatch(/example/i);
  });

  test("are found as sha256 digests", async () => {
    const { createHash } = await import("node:crypto");
    const digest = createHash("sha256").update("examplecorp").digest("hex");
    const [dir, files] = tree({ "x.json": `{"prompt_sha256": "sha256:${digest}"}` });
    expect(sweepPrivate(dir, files, ["ExampleCorp"])).toContainEqual(expect.objectContaining({ rule: "private_digest" }));
  });

  test("skip the repository's own hosting URL", () => {
    const [dir, files] = tree({ "package.json": '{"license": "MIT", "url": "git+https://github.com/examplecorp/dyeworks.git"}', "README.md": "github.com/examplecorp/other\n" });
    const found = sweepPrivate(dir, files, ["examplecorp"], normaliseHostingUrl("https://github.com/examplecorp/dyeworks.git"));
    expect(found.map((f) => f.path)).toEqual(["README.md"]);
  });

  test("refuse a private file inside the repository or missing", () => {
    expect(() => loadPrivate(join(root, "package.json"), root)).toThrow(/inside the repository/);
    expect(() => loadPrivate(join(tmpdir(), "dyeworks-no-such-file"), root)).toThrow(/does not exist/);
  });

  test("normalise the hosting URL in its https and ssh forms", () => {
    expect(normaliseHostingUrl("https://github.com/o/r.git")).toBe("github.com/o/r");
    expect(normaliseHostingUrl("git" + "@" + "github.com:o/r.git")).toBe("github.com/o/r");
  });
});
