# Changelog

Versions are git tags `v<semver>`, published to the npm registry by `release.yml`. A new Theme, Token or Slot
kind with an inert default is a minor; generated images are a patch; a renamed or removed Token, a changed
Slot treatment or a changed manifest shape is a major, recorded here.

## 1.4.1

- The generated images, one per Prompt sheet: `backdrop.webp`, `ornament.png` and `empty.png` for `neon`,
  `circuit` and `psychedelic`, and `backdrop.light.webp`, `backdrop.dark.webp`, `ornament.png` and `empty.png`
  for `pylon`. Each manifest now names an `image` beside every fallback, and each Theme's `provenance.json`
  lists its images with the model, date, the Prompt sheet's digest and the file's digest and size. The
  fallbacks stay in the tree; a manifest entry that names an image resolves to it, one that does not
  resolves to its fallback.
- `npm run theme-assets` asks for the image API's current model (the one it named before was retired); quantises a
  transparent Slot's PNG to a 256-colour palette with alpha when the lossless file is over its budget; and
  keeps a backdrop within its clamp after WebP compression, tightening the clamp on the original pixels until
  the decoded file holds it.

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
