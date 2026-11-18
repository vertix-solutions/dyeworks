slot: backdrop
scheme: light
output: webp
size: 1536x1024
background: opaque
ship: 1536x1024

## Prompt
A wide, very pale abstract desert backdrop for a light software interface. Sun-bleached sand
dunes (#f7f1e4 to #e6dcc6) under a hazy white-gold sky, the horizon low and almost washed
out, like a watercolour left in the sun. Only sand and sky from edge to edge, with no object
anywhere in the frame. Grainy paper texture, soft, calm, empty; nothing darker than light sand.

## Must not
Text, letters, logos, people, animals, buildings, ruins, books, roads, vegetation, water, a
sun disc, hard-edged clouds, strong contrast, crystals, shadows, pools of light, any object on
or above the sand, any area darker than pale sand.

## Accept
luminance clamp against the pylon light Tokens (a light Scheme: the darkest 0.1 % of pixels is
bounded and the image is lightened towards --bg, ADR 0021 §3).
