import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { root } from "./helpers.mjs";

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

test("the package exports every module of the layout, each resolving to a built file", () => {
  expect(Object.keys(pkg.exports)).toEqual(
    expect.arrayContaining([
      "./tokens.css",
      "./themes.css",
      "./slots.css",
      "./registry",
      "./chooser",
      "./boot",
      "./react",
      "./contract-check",
      "./themes/*",
    ]),
  );
  for (const [name, target] of Object.entries(pkg.exports)) {
    if (name.includes("*")) continue;
    const paths = typeof target === "string" ? [target] : Object.values(target);
    for (const p of paths) expect(existsSync(join(root, p)), `${name} → ${p}`).toBe(true);
  }
});

test("the modules import by the package's own name", async () => {
  const registry = await import("dyeworks/registry");
  const { createChooser } = await import("dyeworks/chooser");
  const { bootScript } = await import("dyeworks/boot");
  const { checkContract } = await import("dyeworks/contract-check");
  const react = await import("dyeworks/react");
  expect(registry.themes[0].id).toBe("default");
  expect(typeof registry.options).toBe("function");
  expect(typeof createChooser).toBe("function");
  expect(bootScript({ storageKey: "k" })).toMatch(/^\(function\(\)\{try\{/);
  expect(checkContract({ stylesheets: [] })).toEqual([]);
  expect(Object.keys(react).sort()).toEqual(["IntensityControl", "ThemeMenu"]);
});

test("react is an optional peer dependency and nothing is required at run time", () => {
  expect(pkg.peerDependencies).toEqual({ react: expect.any(String) });
  expect(pkg.peerDependenciesMeta).toEqual({ react: { optional: true } });
  expect(pkg.dependencies ?? {}).toEqual({});
  for (const v of Object.values(pkg.devDependencies)) expect(v).toMatch(/^\d+\.\d+\.\d+$/);
});

test("the packed tarball carries dist, the themes directory and the changelog", () => {
  const [packed] = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8" }));
  const files = packed.files.map((f) => f.path);
  for (const f of ["dist/chooser.js", "dist/chooser.d.ts", "dist/boot.js", "dist/internal/boot-text.js", "dist/internal/resolve.js", "dist/registry.js", "dist/registry.d.ts", "dist/contract-check.js", "dist/react/index.js", "dist/tokens.css", "dist/themes.css", "themes/default/theme.css", "themes/default/theme.json", "tokens.json", "slots.css", "CHANGELOG.md", "LICENSE", "README.md"])
    expect(files, f).toContain(f);
  expect(files.some((f) => f.startsWith("src/") || f.startsWith("test/"))).toBe(false);
});

test("release.yml publishes by trusted publishing from a v<semver> tag with no token", () => {
  const text = readFileSync(join(root, ".github/workflows/release.yml"), "utf8");
  expect(text).toMatch(/tags:\s*\n\s*- "v\*\.\*\.\*"/);
  expect(text).toContain("id-token: write");
  expect(text).toContain("npm test");
  expect(text).toContain("npm run build");
  expect(text).toMatch(/npm publish/);
  expect(text).not.toMatch(/NODE_AUTH_TOKEN|NPM_TOKEN|secrets\./);
});
