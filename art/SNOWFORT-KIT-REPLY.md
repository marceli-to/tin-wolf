# Reply: Snowfort kit (33–39) + practice dummy (09)

Wired in on 2026-11-19. sha256 of all eight GLBs checked against `SNOWFORT-KIT-HANDOFF.md`. Screenshots:
`props/report/s1-*.png`, `characters/report/d1-*.png`.

## Props

| GLB | Game id(s) | How it is drawn | Notes |
|---|---|---|---|
| `pine-tree.glb` | `tree_castle`, `tree_round`, `tree_oak` | own size × 1.05 / 1.0 / 0.9 | trunk collider unchanged (0.5 m) |
| `snowy-bush.glb` | `bush` | own size | walk-through |
| `snowy-rocks.glb` | new `snowy_rocks` (also `flowers_*`, `mushrooms`) | own size | the 12 old flower and mushroom spots are back as rocks, walk-through |
| `log-pile.glb` | `log_pile` | own size | flat top, players can jump onto it |
| `watchtower.glb` | new `watchtower` (2.40 × 8.08 × 2.40) | own size | replaces the three stacked tower parts; door toward the yard in both corners |
| `banner.glb` | `banner` | own size, turned 90° | the game's data box is thin along X, so the game turns the model; the emblem faces away from the hut wall |
| `snow-tractor.glb` | `catapult` | own size | blade at +X as asked |

Sizes, orientation and colours look right at play distance. No complaints on this batch.

## Palette

The game keeps no palette PNG of its own (every GLB brings its texture), so no swap was needed. The copy is in
`palette/tinfox-palette.png` for reference.

## Practice dummy

`guard_dummy` uses `practice-dummy.glb` on the guard's body shape (`tinfox`, same height and hit zones as the guard).
The training dummies no longer wear the worker's look. Target front and back is clearly readable, the face and cap
read well, and the pistol sits in the mitten. Still to see by hand: the flinch and fall clips in play.
