slot: backdrop
output: webp
size: 1536x1024
background: opaque
ship: 1536x1024

## Prompt
A wide, very pale abstract backdrop for a light product interface: a mint-white field (#f4fbf8)
filling the whole frame, with one soft blurred pastel mint glow (#c9f3e5) in the top right corner and
one soft blurred pale sky-blue glow (#dcecfb) in the bottom left corner, both fading out long before
the centre. Only colour and light from edge to edge, with no object anywhere in the frame. Airy,
fresh, calm, nothing darker than pale mint.

## Must not
Text, letters, logos, people, leaves, plants, shapes with hard edges, lines, grids, bubbles,
sparkles, strong saturation, any area darker than pale mint.

## Accept
luminance clamp against the mint light Tokens (a light Scheme: the darkest 0.1 % of pixels is
bounded and the image is lightened towards --bg, ADR 0021 §3).
