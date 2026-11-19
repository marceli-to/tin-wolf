# Practice dummy (09): handoff

Built from `characters/sheets/09-practice-dummy.png` to `PRACTICE-DUMMY.md`. Paths relative to `~/Desktop/tinfox/`.

| File | What |
|---|---|
| `characters/glb/practice-dummy.glb` | the figure, sha256 `609716d1e5e351a5f8c6c05a415f1d81626940fd28fe54011d42afe25506fc68`, 0.90 MB |
| `characters/glb/practice-dummy-preview.png` | three.js test load |
| `characters/glb/practice-dummy-vs-sheet.png` | top: sheet; middle: model; bottom: silhouette overlap |
| `characters/glb/practice-dummy-pistol.png` | `aim_1h` with `pistol.glb` on `handslot.r` (no transform) |

## Same as the guard

- Body `hero-m`, the guard's rig and proportions: skull top 1.80 m, **1.862 m with the cap** (guard 1.897 with its
  cap and antenna, so use the guard's body shape and hit zones). The head joint is where the guard's is.
- KayKit `Rig_Medium` with `handslot.r` / `handslot.l`; shoulder pads blend chest / upper arm like the guard's.
- All **18 clips**, same names and bone lists as the guard; walk / run planted for 1.6 / 4.0 m/s.
- One material `M_Palette`, NEAREST, vertex AO in `COLOR_0`.
- **4,912 triangles** (guard ~5,650).
- Khronos glTF validator 0 errors / 0 warnings; loads in three.js with all 18 clips.

## Dummy-specific

1. **Targets** front and back as geometry: three 16-sided discs (red Ø 0.30 m, cream Ø 0.21, red bullseye Ø 0.10)
   stepped 5 mm apart, on a quilted chest / back pad. Pads and targets are weighted **100 % to `chest`**.
2. **Face:** round canvas head, two dot eyes and a smile (dark brown, a few mm proud). No hair, ears or nose.
3. **Cap:** the guard's cap shape (olive, black peak), no antenna, made 12 % wider for the round head.
4. **Hands:** the guard's mitten + thumb, in brown.
5. **Pads:** shoulders, chest, back, elbows (half upper arm / half forearm), knees (half thigh / half shin), a cushion
   over the belt. The dashed seams are left out, as suggested.
6. **Belt** plain brown band; **collar** a high padded roll, lower than the chin, dark brown inside so the head reads
   apart from it.
7. **Colours** (Tin Fox palette, embedded in the GLB): sand `#E8B66C` (new cell 3, suit and head), brown `#6E4630`
   (gloves, boots, belt), dark brown `#4E2F1A` (soles, collar inside), olive `#666B32` cap, near-black peak, red
   `#D8201C` and cream `#F2E5C0` target, dark eyes / mouth. 8 colours.

## Checks

- Feet on the floor in every clip (nothing below the floor; walk / run contact ok).
- Targets stay flat on chest and back in every clip (rigid on `chest`, no arm blend).
- Pose test: the overlaps found are the guard's own seam categories (arm into the torso at the armpit under the
  shoulder pad, thigh into the jacket's lower edge in run / crouch, trousers into boot tops), all in one sand colour;
  pads don't visibly cut through each other in walk / run / die.
- Pistol in `handslot.r`: in the mitten as on the guard (`practice-dummy-pistol.png`).

Palette note: this batch changed ten unused cells of the Tin Fox palette (sand, snow, greens, granite, wood, glass;
see `SNOWFORT-KIT.md`). If the game keeps its own copy of the palette PNG, replace it with the one in these GLBs.
