# dyeworks

A theme library for web projects on any framework: one **Token contract**, a **Slot vocabulary**, and
**Themes** as directories that set nothing but Tokens. A page reads the Tokens; a Theme changes their
values; the page's layout, components and meanings stay its own.

Status: pre-1.0. The contract, the Slot vocabulary, the `default` Theme, the build, the tests and the demo
page are here; the chooser, the boot script, the React wrapper and the Contract check follow before `1.0.0`.

## What is in the package

| File | What it is |
|---|---|
| `tokens.json` | The Token contract (`dyeworks-tokens/1`): every Token with its tier, type, one-sentence meaning and default. The whole surface between a Theme and a page. |
| `slots.json`, `slots.css` | The Slot vocabulary (`dyeworks-slots/1`): nine kinds of place where decoration may appear, the Tokens each reads, and an optional stylesheet implementing each treatment on `[data-slot="<kind>"]`. |
| `themes/<id>/` | One directory per Theme: `theme.css` (Token declarations only) and `theme.json` (the manifest). |
| `dist/tokens.css` | Every contract default on `:root`, so a page with no Theme attribute renders as `default` light. |
| `dist/themes.css` | Every Theme's declarations. |
| `dist/registry.js` | The generated registry: `themes` (directory order, `default` first) and `options()` for a Theme menu. |
| `dist/reference.html` | The contract's reference page, generated from `tokens.json` and `slots.json`. |

## Consuming it

Install an exact version and import the stylesheets:

```css
@import "dyeworks/tokens.css";
@import "dyeworks/themes.css";
@import "dyeworks/slots.css"; /* optional */
```

Choose a Theme and Scheme on `<html>`:

```html
<html data-theme="default" data-scheme="dark">
```

Read Tokens in your own stylesheet (`background: var(--bg-raised)`), give the data Tokens your own meanings
in one place (`--my-kind-a: var(--series-1)`), and mark your Slots with `data-slot="<kind>"`. Never set a
contract Token yourself: a page maps Tokens, a Theme sets them. Image Tokens resolve under `/themes/<id>/`,
so serve the package's `themes/` directory at that path.

## Tiers

- **surface**: backgrounds, text, borders, the accent, the radius and the type faces.
- **data**: three categorical series colours, six state colours, and the danger and warning colours. They
  carry no meaning of their own; a consumer assigns one.
- **decoration**: glow, gradient, display face and images. Their defaults are inert, so under `default`
  every decorated Slot shows its plain treatment. A Theme reads `--intensity` (0 to 1, set on `<html>`) to
  scale its decoration.

## Developing

```sh
npm ci
npm test                          # shape, manifest, contrast, provenance, Slot, build and Sweep tests
npm run build                     # writes dist/
npm run demo                      # builds, then serves the demo page at http://127.0.0.1:4173/demo/
npm run screenshots -- <outdir>   # the demo page per Theme and Scheme at Intensity 0, 0.5 and 1
```

The Sweep checks the tracked tree for home paths, email addresses, key-shaped strings, colour literals
outside `themes/` and `tokens.json`, and rasters or fonts outside `themes/`. Its private layer runs when
`DYEWORKS_SWEEP_PRIVATE` names a file outside the repository holding one string per line.

## Licence

MIT. See `LICENSE`.
