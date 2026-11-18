// ADR 0020 §1: the library names no consumer. Its tracked tree holds none of a consumer's terms as words; the demo
// page is a generic page. The one allowed line is the README's imperative "run it in your own test suite".
// The terms are assembled at run time so this file never holds them itself.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { trackedFiles } from "../scripts/lib/sweep.mjs";
import { root } from "./helpers.mjs";

const terms = ["local" + "bench", "R" + "un", "St" + "ep", "Gr" + "aph", "Status " + "widget"];
const pattern = new RegExp(`\\b(${terms.join("|")})\\b`);
const allowed = new Set(["README.md: " + "R" + "un it in your own test suite over your stylesheets and inline SVG styles:"]);
const text = /\.(md|mjs|js|ts|tsx|json|css|html|svg|txt|yml|yaml)$/;
const paths = trackedFiles(root);

test.skipIf(paths === null)("the tracked tree uses no consumer's terms", () => {
  const found = [];
  for (const path of paths.filter((p) => text.test(p) && p !== "package-lock.json"))
    readFileSync(join(root, path), "utf8").split("\n").forEach((line, i) => {
      if (pattern.test(line) && !allowed.has(`${path}: ${line}`)) found.push(`${path}:${i + 1}: ${line.trim()}`);
    });
  expect(found).toEqual([]);
});
