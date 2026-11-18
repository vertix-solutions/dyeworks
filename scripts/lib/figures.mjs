// The figure check's judgement, apart from the browser that draws the glyphs: how far apart two glyphs are, and what
// a Theme's result means against the pairs its face is known to fail. `scripts/screenshots.mjs` draws the glyphs.

// The display face sets figures that read as figures (07 §4): at the heading and count Slots a zero is not drawn
// as the capital O or the lowercase o, and a one not as the capital I or the lowercase l. A pair listed here is
// reported without failing the run until that face is fixed. Any other pair fails, and so does a listed pair that
// no longer shows, so the list only ever shrinks.
export const FIGURES_KNOWN_TO_FAIL = { neon: ["0/O"], psychedelic: ["1/I", "1/l"] };

// Two glyphs read alike below this share of differing ink.
export const ALIKE_BELOW = 0.03;

/**
 * The share of the two glyphs' ink that has no ink of the other within 2 px, with `b` shifted `ox` px to the right
 * of `a`. A glyph is its ink cropped to its bounding box: `{ alpha, size, left, top, width, height }`, where `alpha`
 * holds a `size` × `size` canvas's alpha channel. Two glyphs with no ink between them are as far apart as can be (1),
 * so a face that draws nothing never passes as alike. Self-contained, so the page can be handed its source.
 */
export function glyphsApart(a, b, ox) {
  const at = (g, x, y) => x >= 0 && y >= 0 && x < g.width && y < g.height && g.alpha[(y + g.top) * g.size + x + g.left] > 128;
  const near = (g, x, y) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (at(g, x + dx, y + dy)) return true;
    return false;
  };
  let differ = 0;
  let inked = 0;
  for (let y = 0; y < Math.max(a.height, b.height); y++)
    for (let x = Math.min(0, ox); x < Math.max(a.width, b.width + ox); x++) {
      const ia = at(a, x, y);
      const ib = at(b, x - ox, y);
      if (ia || ib) inked++;
      if ((ia && !near(b, x - ox, y)) || (ib && !near(a, x, y))) differ++;
    }
  return inked === 0 ? 1 : differ / inked;
}

/**
 * What one Theme and Scheme's figure check means. `alike` holds the pairs drawn alike, as "figure/letter";
 * `problems` holds what stopped the check itself (a face that did not load). Returns the problems that fail the run
 * and the notes for listed pairs that showed as known. A listed pair is reported as no longer failing only when the
 * check itself ran: a face that did not load draws no pairs, which says nothing about whether the face is fixed.
 */
export function figureProblems(themeId, { alike, problems }, known = FIGURES_KNOWN_TO_FAIL[themeId] ?? []) {
  const failing = [...problems];
  const notes = [];
  for (const pair of alike) {
    const [figure, letter] = pair.split("/");
    if (known.includes(pair)) notes.push(`known: the display face draws "${figure}" like "${letter}"`);
    else failing.push(`the display face draws "${figure}" like "${letter}"`);
  }
  if (problems.length === 0)
    for (const pair of known)
      if (!alike.includes(pair)) failing.push(`${pair} is listed as known to fail but no longer does: remove it from FIGURES_KNOWN_TO_FAIL`);
  return { problems: failing, notes };
}
