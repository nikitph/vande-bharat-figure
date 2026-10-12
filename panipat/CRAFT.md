# Diorama craft notes

These are the rules that came out of refining Panipat. They are the starting point of the diorama motif's craft rules, and each one is here because a frame failed without it.

## Hierarchy
- **Every beat has a hero, and everything else steps back.** Units outside the hero lose most of their colour and drift toward the haze tone (`HEROES` in `src/11-scene.js`). Without this, every unit is equally loud and the eye has nowhere to go.
- **Muting desaturates rather than dims.** Muted figures keep their ink lines and their form, so the scene still reads as one place.

## Light and air
- **Use a time of day.** Panipat is a morning battle, so the sun is low from the east-south-east and shadows are long.
- **Haze with distance.** Colour and ink both fade toward a haze tone with depth from the focus plane. The haze range follows the camera, so close-ups and overviews both get depth.

## Life in the figures
- **Banners give each unit a rhythm.** Standards ride just behind each unit's front, with their flags waving. Pale banners are Babur's, saffron ones Lodi's.
- **No two figures are the same size.** Heights vary by about ±10%.

## A world, not a board
- **Fields come in blocks of aligned plots round the villages**, with earth bunds at the edges. Random rectangles read as noise; plots read as farmland.
- **Hamlets** of thatched huts round a well and a shade tree.
- **Scrub** is thick at the margins and thin where the armies trample.
- **Leave the battle ground open.** Babur chose open ground, and the picture should show it.

## Still to do
- Foreground framing in close-ups: grass, banners or carts passing the lens.
- Composition: put the hero on a third automatically, with lead room ahead of moving units.
- Commanders as distinct figures, and more variety in poses.
- Video export: 1920×1080, supersampled, timed to narration.
