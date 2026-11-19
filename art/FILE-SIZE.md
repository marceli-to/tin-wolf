# Figures: smaller GLBs

All nine Tin Fox figures were exported again. **The set went from 9.80 to 5.76 MB (−41 %)**, with the same meshes,
rig, palette, node names and materials. The clips the game plays are unchanged: checked channel by channel against
the previous copies, with the same values and lengths. This answers point 6 of `_archive/GUARD-REPORT.md`
(file size / shared clips). No game code change is needed.

## What changed

1. **Five clips left out:** `jump`, `attack`, `hit`, `interact`, `crouch_walk`. `src/render/modelCharacter.ts`
   (`tinfoxChar`, `viewArms`) uses none of them. Each figure now has 13 clips:
   `idle`, `walk`, `run`, `die`, `crouch`, `aim_1h`, `shoot_1h`, `aim_2h`, `shoot_2h`, `crouch_aim_1h`,
   `crouch_shoot_1h`, `crouch_aim_2h`, `crouch_shoot_2h`. If the game ever wants one of the five back (e.g. `hit`
   for the dummy's flinch), say so and it goes back in.
2. **Channels that never move are gone:** every `scale` channel and the `translation` channels of bones no clip
   moves (at rest in every clip). A bone without a channel stays at its rest pose, so playback doesn't change.
   Bones that some clip moves keep their channel in every clip (e.g. the upper-arm translation of the 2H stance).
   One side effect: `viewArms.collapse` sets `scale` on `head` / `upperleg.*`. Before, the clips' constant scale
   keys reset that to 1 every frame. Now the collapse holds. With `gunOnly` the figure is hidden anyway, so nothing
   visible should change.
3. **Vertex data packed (core glTF, no extension):** `WEIGHTS_0` and `COLOR_0` (the baked AO) are now normalised
   unsigned bytes, `TEXCOORD_0` normalised unsigned shorts. three.js's `GLTFLoader` reads them as normalised
   attributes:
   - `COLOR_0` is VEC3 in a 4-byte stride, so it loads as an `InterleavedBufferAttribute`;
   - `TEXCOORD_0` and `WEIGHTS_0` load as `Uint16Array` / `Uint8Array` with `normalized: true`.

   The errors are below what can be seen: weights and AO ≤ 1/510, UVs ≤ 0.00002, every UV still in the centre of
   its palette cell. Positions and normals are untouched. The props were not changed (they stay float, since
   `StaticBatch` copies their attributes).

   If any game code reads a figure's `color`, `uv` or `skinWeight` arrays directly, it must use
   `getX` / `getComponent` (they denormalise), not `.array`. I found no such code: `StaticBatch` only handles props.

## Files (`characters/glb/`)

| File | Before | Now | sha256 |
|---|---|---|---|
| `guard.glb` | 1.01 MB | 0.59 MB | `536e5e50…5cfeeab3` |
| `rifle-guard.glb` | 1.18 MB | 0.70 MB | `95eff220…fc47b364` |
| `officer.glb` | 1.25 MB | 0.74 MB | `21e876a2…013db4b1` |
| `worker.glb` | 1.00 MB | 0.58 MB | `5d4ec832…4a7fb569` |
| `player-1.glb` | 1.09 MB | 0.64 MB | `359253fb…a958b235` |
| `player-2.glb` | 1.06 MB | 0.62 MB | `a995bc33…4f4f18b6` |
| `player-3.glb` | 1.15 MB | 0.68 MB | `2fbdd2a6…5546880c` |
| `player-4.glb` | 1.16 MB | 0.68 MB | `751d2099…a086a18f` |
| `practice-dummy.glb` | 0.90 MB | 0.52 MB | `80925165…484aa604` |

Each one passes the glTF validator with 0 errors and 0 warnings and loads in three.js. `player-3.glb` embeds the
current palette image: only the ten Snowfort cells differ, and the figure doesn't use them.

## Not done (your call)

- **One shared animation file per body type** would save about another 0.15 MB per figure. It needs a change in the
  game: load the clips once and bind them to each figure by bone name, since all figures share KayKit `Rig_Medium`.
  Worth it only if load size starts to matter.
- **Positions and normals quantised** (`KHR_mesh_quantization`, which three.js supports) would save about another
  0.1–0.15 MB per figure, but it is an extension. Not done unless you want it.

## Report back

Whether the figures still look and play the same in game (colours and AO, walk/run, aim/shoot 1H/2H, crouch,
die, first person), and whether any of the five clips should come back.
