# Practice dummy: brief for the generator

Sheet: `characters/sheets/09-practice-dummy.png` (prompt `characters/prompts/09-practice-dummy.txt`).
Deliver `characters/glb/practice-dummy.glb` with `practice-dummy-preview.png`, `practice-dummy-vs-sheet.png` and a
short handoff `DUMMY.md` (file, sha256, tris, height, checks), as for the worker. Paths relative to `art/` in the Tin Fox repo.

## What it is in the game

The figure for the guard archetype `guard_dummy` on the Training Ground: it patrols back and forth, flinches when hit,
falls when shot down and is back at its post a few seconds later. It never notices or shoots anyone. Today the
dummies are drawn as the worker. The game runs it through the same code as the guards, so it holds the pistol
in `handslot.r` like any guard and uses the guard clips.

## Same as the guard (build on its parts)

- **Body `hero-m`, the guard's proportions and height** (1.80 m to the skull, ~1.90 m with the cap). The game uses
  the guard's body shape and hit zones (head / torso / limbs) for it, so the head must sit where the guard's does.
- **Rig:** KayKit `Rig_Medium`, `handslot.r` / `handslot.l`, guard weights (pads blend chest / upper arm like the
  guard's shoulder pads).
- **All 18 clips, same names and bone lists as the guard** (`idle`, `walk`, `run`, `jump`, `attack`, `hit`,
  `interact`, `die`, `crouch`, `crouch_walk`, `aim_1h`, `shoot_1h`, `aim_2h`, `shoot_2h`, `crouch_aim_1h`,
  `crouch_shoot_1h`, `crouch_aim_2h`, `crouch_shoot_2h`). In use: `idle`, `walk`, `run`, `die`, and `aim_1h`
  over walk for the arms.
- **Material:** one `M_Palette`, NEAREST, vertex AO in `COLOR_0`; walk/run planted for 1.6 / 4.0 m/s.
- **Budget** about the guard's (~5,600 tris).

## Dummy-specific

1. **Targets are geometry**, front and back: three flat raised discs (red outer ring, cream ring, red bullseye),
   stepped a few millimetres apart so they don't z-fight. They are the point of the figure: big and clearly readable
   at 10–20 m. Keep them on the chest / back so they follow the torso (chest bone only), not the arms.
2. **Face as geometry:** two dot eyes and a smile, like the other faces. No hair, no ears, no nose.
3. **Cap:** the guard's cap shape, olive with a black visor, **without the antenna**.
4. **Hands:** the sheet draws separate fingers; use the usual mitten with a separate thumb, in brown.
5. **Pads:** quilted pads on shoulders, chest, elbows, knees and the belly, as chunky faceted shapes. The stitched
   dashed seams are too small to read in game; skip them, or at most a raised seam line around the big pads if the
   budget allows.
6. **Belt:** brown, no buckle detail needed. Collar: the high padded neck from the sheet; it must not poke into the
   head when the head turns in `aim_1h` / `die`.
7. **Colours:** sand suit and head, brown seams / gloves / boots / belt, olive cap, black visor, red and cream target.
   Keep the sand clearly lighter and warmer than the worker's and guards' colours: it must not read as an enemy.

## Please check

- Feet on the floor in every clip; the pads don't cut through each other in `walk` / `run` / `die`.
- The targets stay flat on the chest and back in every clip (no tearing at the chest/arm blend).
- The pistol in `handslot.r` sits in the mitten like on the guard (same `handslot.r` frame).
