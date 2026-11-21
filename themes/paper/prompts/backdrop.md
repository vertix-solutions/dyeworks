slot: backdrop
output: webp
size: 1536x1024
background: opaque
ship: 1536x1024

## Prompt
A wide, very pale backdrop for a light documentation interface: a single sheet of good uncoated
writing paper (#fbfaf7) seen flat and filling the whole frame, with the faintest warm-grey fibres
(#eae7e0) scattered sparsely and one thin pale red ruled margin line running top to bottom close to
the left edge. Only the paper from edge to edge, with no object anywhere in the frame. Soft, calm,
even light, nothing darker than pale grey.

## Must not
Text, letters, logos, handwriting, ink blots, stains, creases, folds, shadows, a desk, a pen,
horizontal ruled lines, coffee rings, vignetting, any area darker than pale grey.

## Accept
luminance clamp against the paper light Tokens (a light Scheme: the darkest 0.1 % of pixels is
bounded and the image is lightened towards --bg, ADR 0021 §3).
