# Changelog

Versions are git tags `v<semver>`, published to the npm registry by `release.yml`. A new Theme, Token or Slot
kind with an inert default is a minor; generated images are a patch; a renamed or removed Token, a changed
Slot treatment or a changed manifest shape is a major, recorded here.

## 1.4.1

- `pylon`'s backdrops keep their crystals and ground shadows in the far margins, within 56 units of either edge
  of the 1536-unit frame, so the middle of the viewport, where a page's content sits, is plain sand and sky by
  day and plain dune and sky by night; on a page whose content has no opaque surface no figure sits behind text,
  a control or a bar. The two backdrop Prompt sheets ask the same of a generated image. A test holds every
  crystal and shadow of both fallbacks to the margins.
- `pylon`'s display face is now Forum Regular (`forum-400.woff2`, one static Latin-subset woff2 of 23.8 kB,
  declared for weights 400 to 700, `OFL.txt` replaced with Forum's), in place of Marcellus, whose zero is its
  capital O and whose one is a bare stem, so that "Run 00000002" read as letters. Forum is an inscriptional
  Roman with a lowercase in the same spirit, with lining figures: an oval zero narrower than its O, a flagged
  one. `--font-display` is `"Forum", var(--font-sans)` on both Schemes.
- The demo page sets a heading, two counts and a row of bars straight on the backdrop with no surface behind
  them. `npm run screenshots` also takes the first screen at 1440 × 900 and 1280 × 800, and fails when the
  `heading` or `count` Slot draws a zero like O or o, or a one like I or l; `neon` (zero like O) and
  `psychedelic` (one like I) are reported as known and do not fail it until their own fix.
- Not in this release: an `ornament` Slot that takes no room at Intensity 0. Collapsing it would change the
  Slot's treatment, which is a major; it keeps its 28 px box through `1.x`.

## 1.4.0

- The `pylon` Theme (light and dark, `intensity: true`), the first expressive Theme on both Schemes and so the
  first to follow the operating system under `auto`. Day is sun-bleached sand with a lapis accent whose
  `--glow` and `--glow-svg` are a hard offset shadow with no blur; night is indigo dusk with a cerulean accent,
  a translucent raised surface and a glow between circuit's and neon's. 6 px corners. Glow, gradient and image
  opacity are written in `var(--intensity)` in each Scheme's block.
- Its hand-written SVG fallbacks: a backdrop per Scheme (`backdrop.light.svg`, `backdrop.dark.svg`, the first
  per-Scheme asset entry in a shipped manifest) and an `ornament` and `empty` shared by both, with their four
  Prompt sheets under `themes/pylon/prompts/`.
- Its face, Marcellus Regular as one static Latin-subset woff2 (`marcellus-400.woff2`, declared for weights
  400 to 700), with `OFL.txt` beside it. The face fills `--font-display` only.
- The shape test now requires every declaration of `--glow` and `--glow-svg` in an Intensity Theme to read
  `--intensity`, not just one, so a Scheme block cannot leave its glow fixed.

## 1.3.0

- The `psychedelic` Theme (dark only, `intensity: true`): an orange accent with yellow and violet second and
  third colours on deep violet, translucent raised, sunken, border, selected and warning surfaces so the
  backdrop shows through, 14 px corners; glow, gradient and image opacity written in `var(--intensity)`, the
  loudest of the expressive Themes (the backdrop fully on from 0.5, the widest glow, a three-colour gradient).
- Its hand-written SVG fallbacks for `backdrop`, `ornament` and `empty`, and their three Prompt sheets under
  `themes/psychedelic/prompts/`.
- Its face, Righteous Regular as one static Latin-subset woff2 (`righteous-400.woff2`, declared for weights
  400 to 700), with `OFL.txt` beside it. The face fills `--font-display` only.

## 1.2.0

- The `circuit` Theme (dark only, `intensity: true`): a teal accent and an ice-blue second colour on
  near-black, 2 px corners; glow, gradient and image opacity written in `var(--intensity)`, the quietest of
  the expressive Themes.
- Its hand-written SVG fallbacks for `backdrop`, `ornament` and `empty`, and their three Prompt sheets under
  `themes/circuit/prompts/`.
- Its face, Exo 2 as one variable Latin-subset woff2 (`exo2-variable.woff2`, weights 100 to 900), with
  `OFL.txt` beside it. The face fills `--font-sans` as well as `--font-display`, so it carries the whole page.

## 1.1.0

- The `neon` Theme (dark only, `intensity: true`): magenta accent and cyan second colour on deep navy; glow,
  gradient and image opacity written in `var(--intensity)`.
- Its hand-written SVG fallbacks for `backdrop`, `ornament` and `empty`, and their three Prompt sheets under
  `themes/neon/prompts/`.
- Its display face, Rajdhani SemiBold as one Latin-subset woff2 (`rajdhani-600.woff2`, declared for weights
  500 to 700), with `OFL.txt` beside it.
- The Sweep's email rule no longer reads a face's `themes/<id>/OFL.txt`, whose copyright notice the licence
  keeps verbatim.
- `npm run screenshots` now fails when decoration appears outside a Slot, when an Intensity Theme is not flat
  at Intensity 0, or when a decorating Slot is plain above it.
- `npm run theme-assets`: the development-time asset generation script, with its alpha check, backdrop
  luminance clamp, budgets and `provenance.json` (`dyeworks-provenance/1`). It is not part of the published
  package; `sharp` is a development dependency.

## 1.0.0

The first release for consumers.

- The Token contract (`tokens.json`, `dyeworks-tokens/1`) and `dist/tokens.css` with every default on `:root`.
- The Slot vocabulary (`slots.json`, `dyeworks-slots/1`) and the optional `slots.css`.
- The `default` Theme, light and dark, with inert decoration; `dist/themes.css`.
- `dyeworks/registry`: `themes` and `options()`, generated from the Theme directories.
- `dyeworks/chooser`: `createChooser({storageKey, registry, defaults?, mirrorKey?})`.
- `dyeworks/boot`: `bootScript({storageKey, mirrorKey?})`, the inline script applying the choice before the
  first paint.
- `dyeworks/react`: `ThemeMenu` and `IntensityControl`; `react` is an optional peer dependency.
- `dyeworks/contract-check`: `checkContract({stylesheets, tokenMap?, allow?})`.
- The `themes/` directory shipped for consumers to serve at `/themes/`.
