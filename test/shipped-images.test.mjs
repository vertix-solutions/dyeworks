// The asset round's outputs (07 §6, §7): every image a manifest names was made from a Prompt sheet of its Theme,
// and is shipped beside its fallback, at its shipped size, transparent where the sheet asks for it, within the
// backdrop clamp, and listed in provenance.json. A sheet whose manifest entry names no image is a Theme still on
// its fallbacks (07 §1, §7; ADR 0016 §4), so it is not checked here; which Themes ship which images is pinned
// by the designs in themes.test.mjs.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, test } from "vitest";
import { backdropBound, checkAlpha, imageFileName, meetsBounds, parseSheet } from "../scripts/lib/assets.mjs";
import { resolveTokens } from "../scripts/lib/contrast.mjs";
import { contract, themes } from "./helpers.mjs";

const sheetsOf = (t) => {
  const dir = join(t.path, "prompts");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".md"))
    .sort()
    .map((n) => ({ theme: t, name: n, sheet: parseSheet(readFileSync(join(dir, n), "utf8"), n) }));
};

/** Every image a manifest names, with its Slot and Scheme (null for an entry that serves every Scheme). */
const namedImages = (t) =>
  Object.entries(t.manifest?.assets ?? {}).flatMap(([slot, entry]) =>
    "fallback" in entry
      ? entry.image ? [{ slot, scheme: null, image: entry.image }] : []
      : Object.entries(entry).flatMap(([scheme, e]) => (e.image ? [{ slot, scheme, image: e.image }] : [])),
  );

const shipped = themes.flatMap((t) => {
  const named = new Set(namedImages(t).map((n) => n.image));
  return sheetsOf(t).filter((s) => named.has(imageFileName(s.sheet)));
});

describe.each(themes.filter((t) => namedImages(t).length).map((t) => [t.id, t]))("the images %s's manifest names", (_id, theme) => {
  test("each come from a Prompt sheet of the Theme, at the file name the sheet gives it", () => {
    const sheets = sheetsOf(theme);
    for (const { slot, scheme, image } of namedImages(theme)) {
      const at = sheets.find((s) => s.sheet.slot === slot && s.sheet.scheme === scheme);
      expect(at, `${image}: prompts/${slot}${scheme ? `.${scheme}` : ""}.md`).toBeDefined();
      expect(image).toBe(imageFileName(at.sheet));
    }
  });
});

describe.each(shipped.map((s) => [`${s.theme.id}/${s.name}`, s]))("the image of %s", (_where, { theme, sheet }) => {
  const file = imageFileName(sheet);
  const path = join(theme.path, file);

  test("is listed in provenance.json", () => {
    const doc = JSON.parse(readFileSync(join(theme.path, "provenance.json"), "utf8"));
    expect(doc.images.map((e) => e.file)).toContain(file);
  });

  test("ships at its size, transparent or within the clamp as its sheet asks", async () => {
    const { data, info } = await sharp(readFileSync(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect({ width: info.width, height: info.height }).toEqual(sheet.ship);
    if (sheet.background === "transparent") {
      const alpha = checkAlpha({ data, width: info.width, height: info.height, channels: info.channels }, sheet.threshold);
      expect(alpha.detail).toBe("");
      return;
    }
    const schemes = sheet.scheme ? [sheet.scheme] : theme.manifest.schemes;
    const bounds = schemes.map((s) => backdropBound(resolveTokens({ contract, css: theme.css, id: theme.id, scheme: s, intensity: 0.5 }), s, contract));
    const rgb = await sharp(readFileSync(path)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(meetsBounds({ data: rgb.data, channels: rgb.info.channels }, bounds)).toBe(true);
  });
});
