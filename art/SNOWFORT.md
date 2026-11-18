# Snowfort kit: handoff for the generator

Seven static props, no rig. They replace the Kenney castle and nature models in the Snowfort arena, which goes back
to Tin Fox's world: the snowy yard of the Halvard Depot instead of a castle. Prompts: `props/prompts/33`–`39`; sizes
and attachments: `props/README.txt` (batch 5). Paths are relative to `art/` in the Tin Fox repo. Marcel makes the sheets
first; start on a GLB once its sheet is approved. Walls, ground and fog are not models: the game paints them in code.

## What the game needs in each GLB

The rules of `COVER-AND-DEPOT.md` (metres, +Y up, front +Z, origin at floor level in the centre of the footprint,
`M_Palette` with vertex AO, no animation, no named nodes), plus:

| # | File | Game id(s) | Box X × Y × Z (m) | Front (+Z) | Solid | Max tris | Notes |
|---|---|---|---|---|---|---|---|
| 33 | `pine-tree.glb` | `tree_castle`, `tree_oak`, `tree_round` | ~2.2 × 3.4 × 2.2 | any | trunk only (0.5 × 0.5) | 400 | the game scales it 0.9–1.05× for variety; collider is the trunk, the branches are walk-through |
| 34 | `snowy-bush.glb` | `bush` | 0.90 × 0.60 × 0.85 | any | no | 300 | |
| 35 | `snowy-rocks.glb` | `flowers_red`, `flowers_yellow`, `mushrooms` | 0.70 × 0.40 × 0.60 | any | decided in the game | 300 | ground decoration, 12 placements |
| 36 | `log-pile.glb` | `log_pile` | 2.90 × 1.41 × 1.55 | long side | yes | 600 | **flat top** (snow layer): players jump onto it |
| 37 | `watchtower.glb` | `tower_base` + `tower_mid` + `tower_top` | 2.40 × 8.08 × 2.40 | door side | yes, the whole box | 800 | one model for the three stacked Kenney parts; straight sides, the collider is the full box |
| 38 | `banner.glb` | `banner` | 0.75 × 2.60 × 0.05 | emblem side | no | 200 | hangs on a wall: back flat, origin at the **bottom** centre (the game hangs it 0.6 m above the floor) |
| 39 | `snow-tractor.glb` | `catapult` | 2.60 × 1.80 × 1.80 | blade end along +X | yes | 1,000 | long axis along X like the box; full cover |

Notes:

- **33:** the canopy may be wider than the box: only the 0.5 m trunk collides, so players brush through the branches.
  Keep the lowest tier at about 1.0 m or higher so that reads as walking under a tree.
- **37:** the three Kenney parts (base 2.42, middle 2.42, roof 3.24) become one prop in the game's data. Snow on the
  ledges is fine; nothing may stick out of the 2.4 m footprint by more than 10 cm (the corner walls are right there).
- **39:** a working vehicle, not a weapon. The orange blade is at the +X end.

## Order

1. Sheets 33 (the pine sets the nature family), 34–36, then 37 (the tower sets the depot-kit look here), 38, 39.
2. GLBs: 33 (8 placements) and 37 (the corner landmarks) first, then 36, 39, 34, 35, 38.
3. Hand over as before: a short `.md` (file, sha256, size check, previews). The game wires them in and reports back
   with screenshots in `props/report/`.
