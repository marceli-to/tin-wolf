# Players 1–4: new models for `playerModels[0..3]`

Four new GLBs in `characters/glb/`, built from `characters/sheets/05–08`. Paths here are relative to
`art/`.

| Slot | File | Sheet | Size | sha256 | Tris | Height (bbox) |
|---|---|---|---|---|---|---|
| `playerModels[0]` blue | `player-1.glb` | `05-player-1-blue.png` | 1.09 MB | `0b7939d2…eaf18cd58` | 6,246 | 1.905 m (spiky hair) |
| `playerModels[1]` red | `player-2.glb` | `06-player-2-red.png` | 1.06 MB | `7d3b97c0…38686c79` | 6,042 | 1.742 m |
| `playerModels[2]` green | `player-3.glb` | `07-player-3-green.png` | 1.15 MB | `2f79ee98…40038bc73c` | 6,664 | 1.862 m (beanie) |
| `playerModels[3]` yellow | `player-4.glb` | `08-player-4-yellow.png` | 1.16 MB | `ded39c54…621bef532` | 6,690 | 1.776 m (curls, goggles) |

Per player: `characters/glb/player-N-preview.png` (three.js, idle) and `player-N-vs-sheet.png` (top: sheet; middle:
the model front / side / back; bottom: silhouette overlap). Silhouette match after fitting, front / side / back:
blue 0.76 / 0.78 / 0.76, red 0.79 / 0.86 / 0.79, green 0.81 / 0.79 / 0.82, yellow 0.74 / 0.74 / 0.76.

## Same as the guard and the worker

- **Rig and bone names:** the KayKit `Rig_Medium` skeleton, `handslot.r` / `handslot.l`, mitten hands.
  Weights as on the guard (shoulder pads blend chest / upper arm); the only new case is the red player's braid
  (head → chest, see below).
- **18 clips, same names and bone lists as the guard:** `idle`, `walk`, `run`, `jump`, `attack`, `hit`, `interact`,
  `die`, `crouch`, `crouch_walk`, `aim_1h`, `shoot_1h`, `aim_2h`, `shoot_2h`, `crouch_aim_1h`, `crouch_shoot_1h`,
  `crouch_aim_2h`, `crouch_shoot_2h`.
- **Material:** one palette material (`M_Palette`), lit, palette texture with `NEAREST` min/mag, vertex AO in
  `COLOR_0` (multiply). Same palette as the guard.
- **Walk/run speeds:** walk planted for 1.6 m/s, run for 4.0 m/s (`groundSpeed` 1.6 / 4.0, as the guard).

## Bodies

- **Blue and green** use the guard's body (`hero-m`, 1.80 m to the top of the skull). **Red and yellow** use the
  worker's body (`hero-f`, 1.70 m to the skull: narrower shoulders, slimmer waist, wider hips). Height differences
  disappear if the game scales every figure to 1.9 m by its bounding box; the heights above include hair and
  headwear (the blue player's spikes reach 1.905 m).
- **Suits:** one squad suit per body. The blue and green players share the male suit; the red player wears the
  female suit; the yellow player has a variant of it (a white stripe down the centre, white cuff bands, white thigh
  stripes, as on her sheet). Shoulder pads with white stripes, a white name patch, a stand-up collar, a belt with a
  round silver buckle, dark grey gloves and boots.
- **Heads:** blue: big grin, spiky brown hair. Green: grin, short full beard, cuffed beanie (the beanie is the suit
  colour). Red: smile, side-swept hair, a braid to the waist with a white band. Yellow: grin, big curls, goggles
  pushed up on the forehead.
- **Red / yellow hips** (Marcel, after a first look): the thighs angle in and forward at the top and cover the suit's
  lower front and seat, so the legs flow up into the belt instead of hanging under a separate hip shape. The
  checksums above are the updated files.
- The wolf emblem on the left shoulder is not modelled (too small; `GENERATOR.md` said to skip it if needed).

## Colours

The suit (and the green beanie) is one palette cell per player. Blue, red and green use your slot colours
(cells 33 `#2F5F8F`, 17 `#8F3A2F`, 28 `#3F7F3F`). **Yellow does not:** the slot colour `#8F7F2F` came out olive
and read like a guard next to them (`characters/glb/player-4-colour.png`: sheet | slot colour | used). Marcel picked
the brighter one: cell 42 `#FBB40C`, close to the sheet's mustard. If the HUD uses the slot colours, the yellow
player's suit is now brighter than her HUD colour; your call whether to brighten the slot colour to match.

## The red player's braid

The braid hangs from the nape to the waist. Its top is weighted to `head`, blending to `chest` along its length, so
it stays on her back when she runs, crouches or dies (it touches the back by up to ~2 cm in `crouch`). In first
person, collapsing `head` shrinks only the braid's top; the rest stays on the chest (behind the camera).

Checked here: Khronos glTF validator 0 errors / 0 warnings for all four, three.js loads all 18 clips, nothing below
the floor in any clip, feet planted in walk/run.

## Please check

1. The four players next to each other and next to a guard at a few metres: does each read as its colour, clearly
   not an enemy (the green one is the closest to the guards' olive)?
2. Heights after the game's scaling (blue's hair makes his bounding box the tallest).
3. Third-person views of the red player running and crouching: the braid on her back.
4. First person with each player model: nothing in view after the bone collapse (the goggles and the beanie are on
   `head`).
