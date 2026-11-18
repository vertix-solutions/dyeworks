slot: backdrop
scheme: light
output: webp
size: 1536x1024
background: opaque
ship: 1536x1024

## Prompt
A wide, very pale abstract desert backdrop for a light software interface. Sun-bleached sand
dunes (#f7f1e4 to #e6dcc6) under a hazy white-gold sky, the horizon low and almost washed
out, like a watercolour left in the sun. Three or four small faceted blue crystals (deep lapis
#1860ad fading to pale sky blue) float well above the dunes in the upper left, each casting one
small sharp blue shadow on the sand below it. Grainy paper texture, soft, calm, mostly empty;
nothing darker than light sand except the crystals and their shadows.

## Must not
Text, letters, logos, people, animals, buildings, ruins, books, roads, vegetation, water, a
sun disc, hard-edged clouds, strong contrast, a glow around the crystals, any area darker than
pale sand outside the crystals and their shadows.

## Accept
luminance clamp against the pylon light Tokens (a light Scheme: the darkest 0.1 % of pixels is
bounded and the image is lightened towards --bg, ADR 0021 §3).
