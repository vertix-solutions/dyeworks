import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parseStylesheet, varReads } from "../scripts/lib/css.mjs";
import { contract, root, slots } from "./helpers.mjs";

const names = new Set(contract.tokens.map((t) => t.name));
const css = readFileSync(join(root, "slots.css"), "utf8");
const { blocks } = parseStylesheet(css);

test("slots.json lists the nine kinds of the vocabulary in order", () => {
  expect(slots.format).toBe("dyeworks-slots/1");
  expect(slots.slots.map((s) => s.kind)).toEqual([
    "backdrop", "ornament", "wordmark", "heading", "count", "primary_action", "active_navigation", "selected_mark", "empty_illustration",
  ]);
  for (const s of slots.slots) {
    expect(Object.keys(s)).toEqual(["kind", "reads", "treatment"]);
    expect(s.treatment.length).toBeGreaterThan(0);
  }
});

test("every Token a Slot reads is a decoration or surface Token of the contract", () => {
  for (const s of slots.slots) for (const r of s.reads) expect(names, `${s.kind} reads ${r}`).toContain(r);
});

test.each(slots.slots.map((s) => [s.kind, s]))("slots.css implements %s on its attribute selector, reading what it lists", (kind, s) => {
  const own = blocks.filter((b) => b.prelude.startsWith(`[data-slot="${kind}"]`));
  expect(own.length).toBeGreaterThan(0);
  const reads = new Set(own.flatMap((b) => b.declarations.flatMap((d) => varReads(d.value))));
  for (const r of s.reads) expect([...reads], `${kind} reads ${r}`).toContain(r);
  for (const r of reads) expect(s.reads, `${kind} reads only what slots.json lists`).toContain(r);
});

test("selected_mark applies to the selected element only", () => {
  const selected = blocks.filter((b) => b.prelude.includes('[data-slot="selected_mark"]'));
  expect(selected.map((b) => b.prelude)).toEqual(['[data-slot="selected_mark"][data-selected="true"]']);
});

test("slots.css reads only contract Tokens and sets none", () => {
  for (const b of blocks)
    for (const d of b.declarations) {
      expect(d.property.startsWith("--"), `line ${d.line} sets ${d.property}`).toBe(false);
      for (const r of varReads(d.value)) expect(names).toContain(r);
    }
});

test("the Slots that answer Intensity are the image Slots that read --asset-opacity", () => {
  const empty = slots.slots.find((s) => s.kind === "empty_illustration");
  expect(empty.reads).not.toContain("--asset-opacity");
});
