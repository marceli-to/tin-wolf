# Handoff: Snowfort kit (33–39) + practice dummy (09)

For the Tin Fox game agent. Everything is in this folder (`~/Desktop/tinfox/`); paths below are relative to it.
Use it for `?art=tinfox` first, as with the earlier batches.

**Status:** built to `SNOWFORT.md` / `PRACTICE-DUMMY.md` and checked by the generator. Marcel has not reviewed it
yet, so this is a first version: please report what looks or behaves wrong in the game.

## What to read

1. `SNOWFORT-KIT.md`: the seven props (which game ids each one replaces, boxes, triangles, where they differ from the
   drawings).
2. `DUMMY.md`: the practice dummy (rig, clips, targets, colours, checks).

## Files

| File | Replaces | sha256 |
|---|---|---|
| `props/glb/pine-tree.glb` | `tree_castle`, `tree_oak`, `tree_round` | `f6821a4ff090807e7e08d4fe8f89bf7c25355bcc735d39e01122b8f6487d0bd2` |
| `props/glb/snowy-bush.glb` | `bush` | `9a40b722b214278db71f5d44c9c0b2debb608d706cd999f5a988dd550c4663c4` |
| `props/glb/snowy-rocks.glb` | `flowers_red`, `flowers_yellow`, `mushrooms` | `15d78a5397e8f7d497adf0704599d4536401dd26761b6f0d70175829396b3dd6` |
| `props/glb/log-pile.glb` | `log_pile` | `200c31459121d8f8605477fe0aa8f985f366f9cd3e9d4a6bfe4daf4046a09331` |
| `props/glb/watchtower.glb` | `tower_base` + `tower_mid` + `tower_top` (one model) | `918f78e1f8e37d463fc5ea573156ea1cfdd47610efe507b1f1ae5ce8334fa541` |
| `props/glb/banner.glb` | `banner` | `6777c5633b0a99d6dfe83dfd115ceee4589391f80834f3d85096fe58ce86051a` |
| `props/glb/snow-tractor.glb` | `catapult` | `2cc1c551767627ef1308cc7c4c5b46c9fadf383e81f998aa7d4cc3741c8a7d22` |
| `characters/glb/practice-dummy.glb` | practice dummy (09) | `609716d1e5e351a5f8c6c05a415f1d81626940fd28fe54011d42afe25506fc68` |
| `palette/tinfox-palette.png` | the game's copy of the Tin Fox palette, if it keeps one | `028d2323ec8939e910320e568da7cfc9a554efdcebf8ad5091b8696050726b63` |

Next to each GLB: `<name>-preview.png` (three.js test load) and `<name>-vs-sheet.png` (sheet / model / silhouette
overlap). Dummy also: `practice-dummy-pistol.png` (`aim_1h`, `pistol.glb` on `handslot.r`).

## Do first: palette

This batch changed **ten palette cells** that nothing else used (snow, pine/dark/mid green, granite, straw, pale wood,
growth rings, window glass, dummy sand). Every GLB here embeds the new palette (same image as
`palette/tinfox-palette.png`; checked). If the game uses its own palette PNG for recolours or shared materials,
replace it with this one, or these models show wrong colours. Earlier figures, guns and props don't use the changed
cells, so they stay the same.

## Same as before

- Metres, +Y up, front +Z, origin on the floor at the footprint centre (banner: bottom centre).
- One material `M_Palette` (lit, NEAREST sampler, vertex AO in `COLOR_0`).
- Props: one mesh, no animation. Dummy: `hero-m` body, KayKit `Rig_Medium` with `handslot.r/l`, the guard's 18
  clips with the same names (walk/run planted for 1.6 / 4.0 m/s). Treat it like the guard (height 1.862 m with cap).
- Khronos glTF validator: 0 errors / 0 warnings for all eight; all load in three.js.

## Known differences from the drawings (on purpose)

- Built to your collider boxes in `SNOWFORT.md`, not to the drawings: watchtower wider (fills the 2.4 m box), pine's
  lowest tier at 1.0 m, banner cloth longer, banner pole as two 5 cm end caps, tractor blade at **+X**.
- Log pile: flat snow slab on top, no growth rings (triangle budget).
- Dummy: the dashed seams on the sheet are left out.

## Please report back

In `props/report/` and `characters/report/` (as before), or as a reply `.md` in this folder:
- each prop at its game id: size, orientation (tractor blade, tower door at +Z), how it reads at play distance;
- whether the palette swap was needed and the colours look right;
- dummy: hit zones vs the guard, targets readable, clips (hit/die), pistol in the hand.
