# Changelog

Versions are git tags `v<semver>`, published to the npm registry by `release.yml`. A new Theme, Token or Slot
kind with an inert default is a minor; generated images are a patch; a renamed or removed Token, a changed
Slot treatment or a changed manifest shape is a major, recorded here.

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
