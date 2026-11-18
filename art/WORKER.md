# Worker: new model for `looks.worker`

New `characters/glb/worker.glb` (1.00 MB, sha256 `f845866c…07479223`), built from `characters/sheets/04-worker.png`.
It is the figure for `looks.worker` (NPC in the depot and training). Paths here are relative to `art/` in the Tin Fox repo.

Previews: `characters/glb/worker-preview.png` (three.js, idle), `characters/glb/worker-vs-sheet.png`
(top: sheet; middle: the model front / side / back; bottom: silhouette overlap).

## Same as the guard

- **Rig and bone names:** the same KayKit `Rig_Medium` skeleton, same `handslot.r` / `handslot.l`, mitten hands
  (brown work gloves).
- **18 clips, same names and bone lists as the guard:** `idle`, `walk`, `run`, `jump`, `attack`, `hit`, `interact`,
  `die`, `crouch`, `crouch_walk`, `aim_1h`, `shoot_1h`, `aim_2h`, `shoot_2h`, `crouch_aim_1h`, `crouch_shoot_1h`,
  `crouch_aim_2h`, `crouch_shoot_2h`. An NPC probably needs only `idle`, `walk`, `run`, `interact`, `hit`, `die`.
- **Material:** one palette material (`M_Palette`), lit, palette texture with `NEAREST` min/mag, vertex AO in
  `COLOR_0` (multiply). Same palette as the guard.
- **Walk/run speeds:** walk planted for 1.6 m/s, run for 4.0 m/s (`groundSpeed` 1.6 / 4.0, as the guard).

## What's new

- **New body `hero-f`** (narrower shoulders, slimmer waist, wider hips). The guard's head size, so she is
  **1.70 m to the top of the skull, 1.858 m with the hard hat** (the guard: 1.80 / 1.897). If the game scales every
  figure to 1.9 m by its bounding box, she comes out about as tall as the guards; an NPC height of ~1.74 m
  (bounding box) keeps her the drawn ~10 cm shorter.
- **Look:** white hard hat with a crest and a long front brim, ponytail with a grey band, fringe over the right brow;
  teal overalls with a shirt collar, breast pocket and a white name patch with a wrench; sleeves rolled to the elbow,
  bare forearms; brown work gloves with flared cuffs; brown boots; utility belt with a silver buckle and two pouches.
- **Triangles 5,630** (guard 5,654). Fitted to its sheet like the others (silhouette match 0.79 / 0.76 / 0.78
  front / side / back).

Checked here: Khronos glTF validator 0 errors / 0 warnings, three.js loads all 18 clips, feet on the floor in every
clip, foot contact in walk/run (planted 1.60–1.67 m/s). Known: in walk/run the belt pouches dip a few centimetres into
the lifted thigh; it reads as cloth here.

## Please check

1. Worker walking and idling in the depot at a few metres: does she read as a worker (hard hat, teal overalls),
   clearly not an enemy?
2. Her height next to a guard after the game's scaling (see above).
3. `interact` / `hit` / `die` if the NPC uses them: nothing poking through (hat brim vs hands, ponytail vs back).
