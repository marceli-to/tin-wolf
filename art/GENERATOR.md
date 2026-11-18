# Tinfox characters: handoff for the game-pack-generator

Everything the generator needs to turn the sheets in `characters/sheets/` into characters Tinfox can use.
Work in the generator repo; record progress in its PROGRESS.md.

## 1. Inputs that are ready

| File | Character | Tinfox role |
|---|---|---|
| `characters/sheets/01-guard.png` | Guard | `guard` (enemy `guard_basic`, also training dummy and bots) |
| `characters/sheets/02-officer.png` | Officer | `officer` (enemy `guard_officer`) |
| `characters/sheets/03-rifle-guard.png` | Rifle guard | new look for `guard_rifle` (two-handed weapons) |
| `characters/sheets/04-worker.png` | Worker | `looks.worker` (NPC in depot and training) |
| `characters/sheets/05-player-1-blue.png` | Player 1 | `playerModels[0]`, slot colour `#2f5f8f` |
| `characters/sheets/06-player-2-red.png` | Player 2 | `playerModels[1]`, slot colour `#8f3a2f` |
| `characters/sheets/07-player-3-green.png` | Player 3 | `playerModels[2]`, slot colour `#3f7f3f` |
| `characters/sheets/08-player-4-yellow.png` | Player 4 | `playerModels[3]`, slot colour `#8f7f2f` |

All sheets: front / side (facing left) / back, orthographic, empty hands, background #E8E8E8.
Sizes differ (most 1672×941; rifle guard 1536×1024, worker and red player 1448×1086).
`add_reference` scales from head top and floor rows, so that does not matter.

## 2. New in the generator

### Style `tinfox` (new folder `styles/tinfox/`)
- Look: low-poly, faceted, flat shading, flat saturated palette colours (like `lowpoly`, but NOT chibi).
- Proportions: about 5 heads tall, head slightly larger than realistic, broad shoulders,
  slightly oversized hands and boots, sturdy legs.
- Two body archetypes (proportion templates):
  - `hero-m`: guard, officer, rifle guard, player 1 (blue), player 3 (green)
  - `hero-f`: worker, player 2 (red), player 4 (yellow); slimmer waist, narrower shoulders
- Budget: to be decided; suggestion 3,000–5,000 tris per character (up to 4 players + guards on screen).
- Palette: build it from the sheets (olive, black, dark grey, skin, brass, orange, teal, white, brown,
  silver, the four slot colours).
- Skeleton: the standard KayKit `Rig_Medium`. No clavicle bones, so the big padded shoulder
  pieces belong to the torso or the upper arm.

### New kinds of parts
- **Faces as geometry:** eyes, eyebrows, mouth, moustache (officer), beard (green player) as small flat
  pieces on the head. Flat palette colours can't paint them.
- **Hands:** gloves with separate fingers on the sheets; a mitten with a separate thumb probably reads
  the same in game at a lower cost. Decide after the first test.
- **Hair:** short messy (blue), spiky front (blue), braid down the back (red), big curls (yellow),
  ponytail (worker). Curls are the hardest part of the set.
- **Headwear:** cap with antenna (guard), peaked officer cap, helmet with earcups and antenna (rifle guard),
  beanie (green), hard hat (worker), goggles on the forehead (yellow).

### Shared parts (build once, reuse)
| Slot | Parts |
|---|---|
| torso | guard jacket (guard + rifle guard under the vest), officer coat, squad suit m, squad suit f, worker overalls |
| torso extra | armour vest (rifle guard) |
| legs | uniform trousers (guards, players), coat-hem legs (officer), overalls legs (worker), knee pads (rifle guard) |
| feet | big boots with thick soles (everyone; brown for the worker), tall boots (officer) |
| waist | belt with round buckle (brass for enemies, silver for players), utility belt with pouches (worker) |
| hands | black glove (all except the worker), brown work glove (worker) |

The four players differ only in head, hair, headwear and colour: two bodies, four heads, recoloured suits.

### Animations Tinfox needs
Tinfox maps its own names to clip names per art set (`CharacterProfile.clips` in
`src/render/modelCharacter.ts`). Each character GLB needs these clips:

| Tinfox | Needed clip | Generator today |
|---|---|---|
| `idle` | idle | ✅ `idle` |
| `walk` | walk | ✅ `walk` |
| `run` | run | ✅ `run` |
| `die` | death | ✅ `die` |
| `crouch` | crouch idle | ❌ |
| `alert`, `aim` | one-handed aim (arm raised, holding a gun) | ❌ |
| `shoot` | one-handed shoot (aim + recoil) | ❌ |
| armed `two` | two-handed aim and two-handed shoot | ❌ |

- The aim clips are layered over walk/run on the arm bones only (`upperarm`, `lowerarm`, `wrist`, `hand`,
  left and right), so they must not move the legs or hips.
- Source: look for KayKit `Rig_Medium` ranged clips first (1H / 2H aiming and shooting, crouch).
  Hand-keyframed only as the last resort.
- Export the extra clips into the GLB under fixed names (e.g. `crouch`, `aim_1h`, `shoot_1h`, `aim_2h`, `shoot_2h`).

### Things the Tinfox integration uses
- Gun hand: `handslot.r` (the game parents held weapons to a bone; grip position, rotation and scale get tuned there).
- First-person arms: the game collapses bones to zero so they don't block the view. For KayKit that would be
  `head`, `upperleg.l`, `upperleg.r`, `upperarm.l`. Check that skinned parts don't leave stray triangles.
- The game scales every figure to its gameplay height, so height differences between characters disappear
  in game unless Tinfox adds a per-character scale. Model them at natural heights anyway.

## 3. Known issues on the sheets
- **Officer:** the coat reaches mid-thigh; expect the knees and shins to poke through the hem in walk/run
  (same problem as the wizard's robe). Shorten or split the coat if `pose_test` shows it.
- **Small details** (wolf emblem, name tags, cap badges) may be too small to model; skip them if needed.
- **Red player:** the braid is hidden in the front view by design (it hangs straight down the back).

## 4. Order of work
1. Style `tinfox` with the `hero-m` proportion template (from the guard sheet).
2. Guard: reference, spec, parts, fit against the sheet, rig, animate.
3. The missing clips (crouch, 1H/2H aim and shoot), exported under fixed names.
4. Guard in Tinfox: a new art-set profile, Kenney blasters for now, one level.
5. Officer and rifle guard (reuse the guard's parts).
6. `hero-f` template; worker.
7. Players: two suit bodies, four heads.
8. Weapons (see `weapons/`); needs the prop mode below.

## 5. Weapons and props (later)
- Prop mode in the generator: no rig, no animation; size in metres; origin rules.
- **Weapons must export two named points:** `grip` (where the hand holds it) and `muzzle` (barrel tip).
  Tinfox currently guesses both from the mesh shape (`attachHeldGun` and `findMuzzle` in
  `src/render/modelCharacter.ts`); it will switch to the named points.
- Weapons are seen up close in first person: they get a larger tris budget than barrels or boxes.
- Prompts for the weapon sheets are in `weapons/prompts/`, the approved sheets in `weapons/sheets/` (01 pistol … 06 ammo).
- Sheet notes: the grip and the barrel tip are clear on all four guns (side view, muzzle to the right).
  Sniper: the top view is drawn about 10 % shorter than the side view; take the length from the side view.
  Grenade: the ring stands upright in the side view but lies flat in the top view; model it upright.
  Ammo: the middle column is not a real top view (the magazine is drawn lying down); use the side and front views.
  The magazines inside the SMG and the sniper are silver, the ammo pickups dark grey with orange; pick one look.
