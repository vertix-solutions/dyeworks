// The figure check's judgement: glyph distance and what a Theme's result means against its known pairs.
import { describe, expect, test } from "vitest";
import { ALIKE_BELOW, FIGURES_KNOWN_TO_FAIL, figureProblems, glyphsApart } from "../scripts/lib/figures.mjs";

const SIZE = 16;
// A glyph from rows of "#" (ink) and "." (none), cropped to its ink the way the page crops a canvas.
const glyph = (rows) => {
  const alpha = new Uint8ClampedArray(SIZE * SIZE);
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === "#") alpha[y * SIZE + x] = 255; }));
  let left = SIZE, top = SIZE, right = -1, bottom = -1;
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] <= 128) continue;
    const x = i % SIZE;
    const y = (i - x) / SIZE;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { alpha, size: SIZE, left, top, width: right - left + 1, height: bottom - top + 1 };
};
const stem = glyph(Array(12).fill("..##"));
const flagged = glyph(["#######", "#######", ...Array(10).fill("....###")]);
const blank = glyph([]);

describe("glyphsApart", () => {
  test("finds a glyph alike to itself wherever it was drawn", () => {
    expect(glyphsApart(stem, glyph(Array(12).fill(".......##")), 0)).toBe(0);
  });

  test("finds a flagged one apart from a bare stem", () => {
    expect(glyphsApart(flagged, stem, 0)).toBeGreaterThan(ALIKE_BELOW);
  });

  test("never finds two glyphs that draw nothing alike", () => {
    expect(glyphsApart(blank, blank, 0)).toBe(1);
    expect(glyphsApart(blank, blank, 0) < ALIKE_BELOW).toBe(false);
  });

  test("survives being handed to the page as source", () => {
    const rebuilt = new Function(`return (${glyphsApart.toString()})`)();
    expect(rebuilt(flagged, stem, 0)).toBe(glyphsApart(flagged, stem, 0));
  });
});

describe("figureProblems", () => {
  test("passes a face that draws no pair alike", () => {
    expect(figureProblems("pylon", { alike: [], problems: [] })).toEqual({ problems: [], notes: [] });
  });

  test("notes a listed pair without failing", () => {
    const { problems, notes } = figureProblems("neon", { alike: ["0/O"], problems: [] });
    expect(problems).toEqual([]);
    expect(notes).toEqual(['known: the display face draws "0" like "O"']);
  });

  test("fails a pair that is not listed", () => {
    expect(figureProblems("neon", { alike: ["0/O", "1/I"], problems: [] }).problems).toEqual(['the display face draws "1" like "I"']);
  });

  test("fails a listed pair that no longer shows", () => {
    expect(figureProblems("neon", { alike: [], problems: [] }).problems).toEqual([
      "0/O is listed as known to fail but no longer does: remove it from FIGURES_KNOWN_TO_FAIL",
    ]);
  });

  test("reports only the load when a listed Theme's face did not load", () => {
    const load = "the face Rajdhani did not load, so its figures were not checked";
    expect(figureProblems("neon", { alike: [], problems: [load] })).toEqual({ problems: [load], notes: [] });
  });

  test("lists only pairs of a figure and a letter it could be read as", () => {
    const pairs = new Set(["0/O", "0/o", "1/I", "1/l"]);
    for (const listed of Object.values(FIGURES_KNOWN_TO_FAIL)) for (const pair of listed) expect(pairs.has(pair)).toBe(true);
  });
});
