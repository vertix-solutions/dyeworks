// The asset round's outputs (07 §6, §7): every Prompt sheet has its image shipped beside its fallback, named in
// the manifest, at its shipped size, transparent where the sheet asks for it, within the backdrop clamp, and
// listed in provenance.json.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, test } from "vitest";
import { backdropBound, checkAlpha, clampBackdrop, imageFileName, parseSheet } from "../scripts/lib/assets.mjs";
import { resolveTokens } from "../scripts/lib/contrast.mjs";
import { contract, themes } from "./helpers.mjs";

const sheets = themes.flatMap((t) => {
  const dir = join(t.path, "prompts");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".md"))
    .sort()
    .map((n) => ({ theme: t, name: n, sheet: parseSheet(readFileSync(join(dir, n), "utf8"), n) }));
});

test("the round covers the thirteen Prompt sheets", () => {
  expect(sheets).toHaveLength(13);
});

describe.each(sheets.map((s) => [`${s.theme.id}/${s.name}`, s]))("the image of %s", (_where, { theme, sheet }) => {
  const file = imageFileName(sheet);
  const path = join(theme.path, file);

  test("is named in the manifest beside its fallback", () => {
    const entry = theme.manifest.assets[sheet.slot];
    const at = sheet.scheme ? entry[sheet.scheme] : entry;
    expect(at.image).toBe(file);
  });

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
    const clamped = clampBackdrop({ data: rgb.data, width: rgb.info.width, height: rgb.info.height, channels: rgb.info.channels }, bounds);
    expect(clamped.changed).toBe(false);
  });
});
