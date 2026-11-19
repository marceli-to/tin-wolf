# Grenade launcher "Pelican" + its refill pickup

Built from `weapons/sheets/07-orb-blaster.png` and `08-orb-refill.png` (prompts `weapons/prompts/07`, `08` in the
game repo). Same frame and material as `PISTOL.md` / `WEAPONS.md`. Paths here are relative to `~/Desktop/tinfox/`.

| File | Type | Size | Triangles | sha256 |
|---|---|---|---|---|
| `weapons/glb/grenade-launcher.glb` | weapon, two-handed | 0.90 m long, 0.66 m tall (incl. sight), 0.35 m wide | 3,344 | `d51d47c0…` |
| `weapons/glb/ammo-grenade-launcher.glb` | pickup | 0.19 × 0.09 × 0.087 m | 930 | `7e3f0587…` |

Previews: `<name>-preview.png` (three.js, the GLB alone), `<name>-vs-sheet.png` (top: sheet views; middle: the
model; bottom: silhouette overlap), `grenade-launcher-in-hand.png` (on the guard's `handslot.r`, no offset, `aim_2h`,
two angles).

## As before

- **One material** `M_Palette`, lit, Tin Fox palette texture (`NEAREST`), vertex AO in `COLOR_0`. No skin, no
  animations.
- **Sizes:** 1.2 × the prompt (75 cm → 0.90 m, 16 cm → 0.19 m), like every other weapon, so **scale 1** next to the
  Tin Fox figures.
- **Launcher:** origin = `grip` node (the rear handle). +X = barrel direction, +Y up, +Z the item's right side
  (the frame of `handslot.r` while aiming); parent it to `handslot.r` as it is. Nodes:
  - `muzzle` (0.670, 0.295, 0): centre of the nozzle's front face. The bore is 14 cm wide; orbs and the flash start
    here and go along +X.
  - `grip_l` (0.513, 0.020, 0): the front handle under the nozzle (as on the SMG/sniper; the 2H clips don't reach
    it, ignore it if you don't use it).
- **Pickup:** no anchors, origin at the centre of the bottom (stands on the floor).

## Notes

- **The drum turns about the side axis** (as the sheet's side view draws it): six orbs show on each side, the
  silver hub in the middle. The sheet's front view draws the orbs round the nozzle instead; the model follows the
  side view, so the front view is boxier than the sheet (IoU front 0.82, side 0.87, top 0.85).
- **3,344 triangles:** above the weapon target (2,500), under the hard limit (4,000): the twelve orbs and sockets
  cost ~1,300. Say if it should be cheaper (fewer orb facets).
- **The shoulder rest** sits just in front of the chin in `aim_2h` (no clipping; see the in-hand image). A launcher
  shouldered lower would need its own 2H stance on our side.
- **Orbs:** the launcher's drum orbs are balls 9.4 cm across (olive, orange band); the refill's orbs are short
  capsules (olive dome, orange band, silver base) 5.3 cm across, as the two sheets draw them. If you want a
  projectile mesh, either orb can be exported on its own (tell us which and at what size).
- Refill: long along X; the orange stripes face +Z, the orange latch tab −Z. IoU 0.96 / 0.93 / 0.95.

Checked here: Khronos glTF validator 0 errors / 0 warnings for both; both load in three.js; nodes as listed.

## Please check

1. The launcher in the guards'/players' hands, standing and crouched: does it sit in the mitten and point where it
   shoots? Does the shoulder rest clear the face?
2. Projectile / flash start at `muzzle` (front face of the orange nozzle).
3. First person: does a 0.90 m launcher fit the view?
4. The refill on the floor: size and read from a few metres (you scale the other pickups; this one is at 0.19 m).
5. Do you want a separate orb mesh (or an `orb` node) for the projectile?
