# dyeworks

A theme library for web projects on any framework: one **Token contract**, a **Slot vocabulary**, and
**Themes** as directories that set nothing but Tokens. A page reads the Tokens; a Theme changes their
values; the page's layout, components and meanings stay its own.

Status: `1.0.0`, the first release for consumers. See `CHANGELOG.md`.

## What is in the package

| File | What it is |
|---|---|
| `tokens.json` | The Token contract (`dyeworks-tokens/1`): every Token with its tier, type, one-sentence meaning and default. The whole surface between a Theme and a page. |
| `slots.json`, `slots.css` | The Slot vocabulary (`dyeworks-slots/1`): nine kinds of place where decoration may appear, the Tokens each reads, and an optional stylesheet implementing each treatment on `[data-slot="<kind>"]`. |
| `themes/<id>/` | One directory per Theme: `theme.css` (Token declarations only) and `theme.json` (the manifest). |
| `dist/tokens.css` | Every contract default on `:root`, so a page with no Theme attribute renders as `default` light. |
| `dist/themes.css` | Every Theme's declarations. |
| `dist/registry.js` | The generated registry: `themes` (directory order, `default` first) and `options()` for a Theme menu. |
| `dyeworks/chooser` | `createChooser({storageKey, registry, defaults?, mirrorKey?})`: keeps the choice, resolves it and writes it on `<html>`. |
| `dyeworks/boot` | `bootScript({storageKey, mirrorKey?})`: the inline script that applies the choice before the first paint. |
| `dyeworks/react` | `ThemeMenu` and `IntensityControl` over a chooser (`react` is an optional peer dependency). |
| `dyeworks/contract-check` | `checkContract({stylesheets, tokenMap?, allow?})`: the Contract check a consumer runs in its own tests. |
| `dist/reference.html` | The contract's reference page, generated from `tokens.json` and `slots.json`. |

## Consuming it

Install an exact version (`npm install --save-exact dyeworks@1.0.0`) and import the stylesheets:

```css
@import "dyeworks/tokens.css";
@import "dyeworks/themes.css";
@import "dyeworks/slots.css"; /* optional */
```

Serve the package's `themes/` directory at `/themes/` (copy it into your public directory at build time):
image Tokens resolve to `url(/themes/<id>/<file>)`.

Embed the boot script in your page's `<head>`, before your stylesheets, so the choice applies before the
first paint. Generate it at build time:

```js
import { bootScript } from "dyeworks/boot";
const inline = `<script>${bootScript({ storageKey: "myapp.theme", mirrorKey: "myapp.theme.default" })}</script>`;
```

Create one chooser with your own storage key, and render your own controls from the registry, or the React
ones:

```js
import * as registry from "dyeworks/registry";
import { createChooser } from "dyeworks/chooser";
import { ThemeMenu, IntensityControl } from "dyeworks/react";

const chooser = createChooser({ storageKey: "myapp.theme", registry, defaults: serverDefault, mirrorKey: "myapp.theme.default" });
// <ThemeMenu chooser={chooser} /> <IntensityControl chooser={chooser} />
```

The stored object is `{"theme": "<id>", "scheme": "auto" | "light" | "dark", "intensity": 0..1}`; a missing
or malformed field reads as `default`, `auto`, `0.5`, and an unknown id as `default`. `defaults` applies only
while storage holds nothing; the chooser copies it to `mirrorKey` so the boot script applies it next load.
`chooser.get()`, `chooser.set(partial)`, `chooser.resolved()`, `chooser.subscribe(fn)` and
`chooser.destroy()` are the whole interface; `chooser.registry` is the registry it was given.

Read Tokens in your own stylesheet (`background: var(--bg-raised)`), give the data Tokens your own meanings
in one place, the Token map (`--my-kind-a: var(--series-1)`), and mark your Slots with `data-slot="<kind>"`.
Never set a contract Token yourself: a page maps Tokens, a Theme sets them.

## The Contract check

Run it in your own test suite over your stylesheets and inline SVG styles:

```js
import { checkContract } from "dyeworks/contract-check";

const findings = checkContract({
  stylesheets: [{ path: "src/app.css", text: appCss }],
  tokenMap: tokenMapCss,                 // optional
  allow: ["color: black"],              // optional: declarations you vouch for
});
expect(findings.filter((f) => !f.allowed)).toEqual([]);
```

Each finding is `{path, line, rule, detail, allowed}`. The rules:

1. Every `var(--…)` read is a contract Token, `--intensity`, or a custom property declared in the
   stylesheets given (or the Token map).
2. No contract Token is set: a consumer maps, it never overrides.
3. No colour literal (hex, `rgb()`, `hsl()`, `color()`, a literal inside `color-mix()`, a named colour) in a
   `color`, `background*`, `fill`, `stroke`, `border*`, `outline*`, `text-decoration*` or `accent-color`
   value. Shadows (`box-shadow`, `text-shadow`, `drop-shadow()`) are exempt; `transparent` and
   `currentcolor` are not literals. A declaration listed in `allow` is reported with `allowed: true`.
4. The Token map maps each `--series-*` and `--state-*` at most once and nothing else of the contract. Its
   findings carry the path `token map`.

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
npm run build                     # writes dist/: the generated files and the compiled src/
npm run demo                      # builds, then serves the demo page at http://127.0.0.1:4173/demo/
npm run screenshots -- <outdir>   # the demo page per Theme and Scheme at Intensity 0, 0.5 and 1
npm run theme-assets              # a Theme author's step: generate missing images from the Prompt sheets
```

`npm run theme-assets [-- --theme <id> --slot <slot> --force]` reads every Prompt sheet under
`themes/<id>/prompts/`, asks the image API for each asset whose image is not yet shipped (or every one with
`--force`), resizes and strips it, checks a transparent Slot's alpha (retrying the sheet up to three times),
clamps a backdrop's luminance towards `--bg` in its Scheme's direction, fails an image over its budget, writes
the image beside its fallback, updates `provenance.json`, and prints the manifest line to add. Its key is read
from the environment of the machine that runs it; without it the script prints one line, exits non-zero and
changes nothing. Nothing a consumer runs, and no test or build here, calls the image API: the images are
committed.

The Sweep checks the tracked tree for home paths, email addresses, key-shaped strings, colour literals
outside `themes/` and `tokens.json`, and rasters or fonts outside `themes/`. Its private layer runs when
`DYEWORKS_SWEEP_PRIVATE` names a file outside the repository holding one string per line.

## Releasing

Pushing a tag `v<semver>` that matches `package.json`'s version runs `.github/workflows/release.yml`: it
builds, tests and publishes to the npm registry by trusted publishing. No token lives in any file.

## Licence

MIT. See `LICENSE`.
