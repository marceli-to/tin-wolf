# Snowfort kit (33–39): handoff

Seven GLBs in `props/glb/`, built from `props/sheets/33`–`39` to `SNOWFORT.md`. For `?art=tinfox` first, as before.
Paths are relative to `~/Desktop/tinfox/`.

| File | Game id(s) | Box X × Y × Z (m), as built | Your box | Triangles (max) | sha256 |
|---|---|---|---|---|---|
| `pine-tree.glb` | `tree_castle`, `tree_oak`, `tree_round` | 2.20 × 3.40 × 2.20 | ~same | 398 (400) | `f6821a4f…` |
| `snowy-bush.glb` | `bush` | 0.90 × 0.60 × 0.85 | same | 292 (300) | `9a40b722…` |
| `snowy-rocks.glb` | `flowers_red`, `flowers_yellow`, `mushrooms` | 0.70 × 0.40 × 0.60 | same | 276 (300) | `15d78a53…` |
| `log-pile.glb` | `log_pile` | 2.90 × 1.41 × 1.55 | same | 592 (600) | `200c3145…` |
| `watchtower.glb` | `tower_base` + `tower_mid` + `tower_top` | 2.40 × 8.08 × 2.40 | same | 796 (800) | `918f78e1…` |
| `banner.glb` | `banner` | 0.75 × 2.60 × 0.05 | same | 200 (200) | `6777c563…` |
| `snow-tractor.glb` | `catapult` | 2.60 × 1.80 × 1.80 | same | 980 (1,000) | `2cc1c551…` |

Previews per prop: `<name>-preview.png` (three.js, the GLB alone), `<name>-vs-sheet.png` (top: sheet views; middle:
the model; bottom: silhouette overlap; white snow against the sheet's light grey background drops out of the sheet
mask, so the overlap row undercounts snowy parts).

## Same as before

- Metres, +Y up, front +Z, origin at floor level in the centre of the footprint (banner: bottom centre). Bounding
  boxes checked from the GLB accessors.
- One material `M_Palette` (lit, Tin Fox palette, `NEAREST`, vertex AO in `COLOR_0`), one mesh node, no animation.
- Khronos glTF validator 0 errors / 0 warnings for all seven; each loads in three.js.

## Per prop

- **Pine tree:** four snow-capped tiers on a trunk 0.46 m wide (inside your 0.5 m collider); the lowest tier starts at
  1.0 m as asked (the sheet has it lower), so the tiers above are a little squeezed. Front: any side.
- **Snowy bush:** four juniper clumps with snow caps on a low snow mound, squeezed to your 0.60 m height.
- **Snowy rocks:** a big granite rock, two small ones, snow tops, two straw-yellow grass tufts.
- **Log pile:** 18 eight-sided logs (rows 5 / 4 / 5 / 4) with pale ends facing +Z and −Z, as on the sheet's front
  view; four dark posts at the corners; a **flat snow slab on top at 1.41 m** (straight edge: the drip edge didn't fit
  in 600). No growth rings (budget).
- **Watchtower:** concrete base with the door (+Z), olive middle with bolted panels and a narrow window on each side,
  cabin with a window band and an orange stripe, overhanging roof with snow, searchlight and antenna (its tip is the
  8.08 m top). **Wider than drawn:** the sheet's tower is slim (base ~1.7 m of 2.4), so to fill your collider the
  base is 2.20 m, the middle 2.04, the cabin ~2.28 and the roof 2.40 (nothing outside the box).
- **Banner:** olive cloth with orange side borders and a swallowtail, a white badge (ring, two peaks, a small drone)
  as raised geometry, centred ~1.86 m above the origin. The back is flat; the pole is two hexagonal end caps
  5 cm deep (a round pole doesn't fit in 5 cm). The sheet is drawn shorter, so the cloth is longer than drawn.
- **Snow tractor:** blade at **+X** as `SNOWFORT.md` asks (the sheet's side view draws it on the other side; the top
  and side comparisons are mirrored for that reason). Tracks with four road wheels a side, light grey body and cab,
  glass all round, grille, headlights, orange stripes and markers, roof rack with an olive box and four orange
  beacons, snow on the roof. Built at the sheet's proportions and scaled to your box (height × 0.92).

## Palette

Ten cells of the Tin Fox palette changed (all were unused by every figure, gun and prop so far), embedded in these
GLBs and in `practice-dummy.glb`: 41 snow `#EEF0F5`, 62 pine green `#4C7220`, 60 dark green `#33661A`, 61 mid green
`#55891F`, 40 granite `#7C7C7E`, 59 straw `#E2B930`, 0 pale wood `#F1C784`, 2 growth rings `#D9A35E`, 56 window glass
`#434E59`, 3 dummy sand `#E8B66C`. If the game ships its own copy of the palette PNG, replace it with the one embedded
here.

With this batch everything in `MISSING.md` has a model (the practice dummy: `DUMMY.md`).
