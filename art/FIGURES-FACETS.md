# Figures: broader facets (all nine)

From the generator, 2026-11-19. Drop-in replacement for every Tin Fox figure. Same rig, bones, clips (the 13 the
game plays), node names, palette, heights and hit zones as before. Only the mesh changed.

## What changed

- **Fewer, broader facets**, like the sheets: arms, legs and torsos are chamfered boxes (4 broad faces + 4 narrow
  45° chamfers) instead of 14–16-sided tubes. Heads have 12 sides with a flat front face (was 20). Shoulder pads
  have 8 sides. Boots, gloves and soles have a single chamfer.
- **23 % fewer triangles, 19 % smaller files** on average (table below).
- **The material is single-sided now** (`doubleSided: false`). Every figure is made of closed shells, so the GPU
  can skip back faces. If anything looks see-through in the game, tell me (I don't expect it).
- **The palette image in each GLB is the current one.** Seven figures carried the palette from before the
  Snowfort cells. That was harmless (none of the changed cells were used), but it's fixed now.
- Each figure was re-fitted to its sheet. The fit score went the same way or up (guard 0.80/0.77/0.79 →
  0.80/0.79/0.79 IoU front/side/back).

## Files

`characters/glb/<name>.glb`, `<name>-preview.png` (three.js test load), `<name>-vs-sheet.png` (sheet next to the
render). The previous GLBs are in `_archive/facets-before/`.

| Figure | Triangles before → now | Bytes before → now | sha256 |
|---|---|---|---|
| guard | 5,654 → 4,310 | 589,424 → 478,064 | `cf8a0602…` |
| rifle-guard | 7,058 → 5,522 | 700,528 → 574,984 | `d286924e…` |
| officer | 7,526 → 5,750 | 742,456 → 599,512 | `08dd1864…` |
| player-1 | 6,246 → 4,854 | 638,704 → 520,208 | `7453c914…` |
| player-3 | 6,664 → 5,272 | 677,896 → 561,684 | `f041187e…` |
| practice-dummy | 4,912 → 3,472 | 519,816 → 406,116 | `0e218077…` |
| worker | 5,630 → 4,638 | 583,552 → 503,744 | `e440d425…` |
| player-2 | 6,042 → 4,762 | 620,708 → 515,324 | `a2346373…` |
| player-4 | 6,690 → 5,346 | 682,596 → 571,356 | `bb87d07a…` |

All nine: glTF validator 0 errors / 0 warnings, three.js test load ok, no style violations.

## Please check

1. **Back faces:** nothing should look hollow or see-through, especially collars, the officer's coat skirt (an
   open, thick sheet) and the beard/moustache.
2. **Back of bent knees** in crouch and run: with 8 sides the back of the knee shows a coarser wedge than before.
3. Readability at 7 m: guards, officer and rifle guard should still read as three enemies, the players as players.
4. The lighting brief (`FIGURE-LIGHTING.md`) is still open; if its answer asks for lower AO on our side, I'll do
   that in a separate pass.

Screenshots in `characters/report/fc-*` would be ideal.
