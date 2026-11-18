# Cover and depot kit: handoff for the generator

Sixteen static props, all without a rig. They replace the Kenney models the game still uses for its cover and for the
furniture in the Halvard Depot. Prompts: `props/prompts/05`–`20`; sizes and attachments: `props/README.txt`. Paths are
relative to `art/` in the Tin Fox repo. The sheets come first (Marcel makes them in ChatGPT). Start on a GLB once its sheet is approved.

## Why these

| Group | Props | Placements |
|---|---|---|
| Generic cover | supply crate, large crate, cargo container, storage barrel | 58 in the depot, training, snowfort, test room |
| Depot interior | locker, shelf, cabinet, desk, terminal, console, bunk bed, mess table, chair, office chair, armchair, drawer cabinet | 42, all but six in the depot |

The cover is the best value: four simple models, about 60 placements. The depot kit is the most "toy" part of the game
next to the new soldiers (Kenney's home furniture: wooden bookcases, a lounge chair).

## What the game needs in each GLB

Same conventions as `pistol.glb`, with the axes of a placed object:

- **Units and axes:** metres, +Y up, the **front faces +Z** (the side shown in the sheet's FRONT view, unless the
  table below says otherwise). The game turns props in 90° steps, so the front must be a clean, flat side.
- **Origin:** at floor level, in the centre of the footprint.
- **Size:** exactly the box in the table. The game stretches each model to its collision box, so a model with
  other proportions gets distorted. Model the box, not the sheet's guessed sizes.
- **Material:** the figures' palette material `M_Palette` (lit, the Tin Fox palette texture with `NEAREST` min/mag, vertex AO in
  `COLOR_0`). One material per prop is ideal. New palette cells are fine: light grey and light blue screens are new.
- **No animation and no named nodes.** Doors and drawers stay closed; the game never opens them.
- **Triangles:** cover at most 400 each (up to 12 barrels in one level). Furniture at most 800. Terminal and console at most 1,500.
- **Flat tops** on the crates and the container: players crouch behind them and jump onto them.

| # | Game id(s) | Box X × Y × Z (m) | Front (+Z) | Notes |
|---|---|---|---|---|
| 05 | `crate` | 0.97 × 0.93 × 0.93 | any face | half cover; the most common prop |
| 06 | `crate_tall` | 1.55 × 1.41 × 1.54 | any face | full cover |
| 07 | `cargo` | 2.90 × 1.41 × 1.55 | long side | doors on the −X/+X end, as on the sheet's side view |
| 08 | `barrel` | 0.68 × 1.05 × 0.62 | any | model it round (0.65 Ø); the game's box is slightly oval |
| 09 | `locker` | 0.71 × 1.92 × 0.36 | doors | stands against walls, back never seen |
| 10 | `shelf` | 1.03 × 2.00 × 0.41 | open side | back against the wall |
| 11 | `shelf_wide`, `bookcase` | 1.48 × 2.00 × 0.41 | doors | also used squeezed to 1.10 × 2.02 × 0.40 |
| 12 | `lab_desk`, `lab_desk_small`, `desk` | 1.65 × 0.75 × 0.82 | seat side | also used stretched to 2.27 and to 1.49 × 0.75 × 0.70: keep details off the long sides' middle |
| 13 | `terminal` | 0.90 × 1.30 × 0.60 | screen | players walk up to it and use it |
| 14 | `console` | 1.40 × 1.20 × 0.70 | screens | the mission target; when destroyed the game hides it, no broken version needed |
| 15 | `bunk_bed` | 0.99 × 1.65 × 2.04 | head end | the sheet's FRONT view (long side with ladder) lies along Z; the game's box is only 0.75 high (you can't climb it) |
| 16 | `mess_table` | 1.28 × 0.74 × 2.50 | short end | long along Z, like the bunk |
| 17 | `chair` | 0.43 × 0.91 × 0.54 | seat | not solid in the game |
| 18 | `office_chair` | 0.61 × 0.96 × 0.69 | seat | not solid |
| 19 | `armchair` | 1.07 × 0.88 × 0.94 | seat | |
| 20 | `side_table` | 0.71 × 0.61 × 0.61 | drawers | |

Not in this batch (stay Kenney for now): `chest` (1, depot), `satellite_dish` (1, depot yard), the arena theme kits.
Not needed at all: `crate_large`, `barrel_small`, `closet`, `shelf_low`, `lab_chair` and `stool` exist in the data but
have no placements.

## Order

1. Sheets 05–08, then 09 (the locker sets the kit's look), then 10–20.
2. GLBs: the cover first (05–08), then 09, 12, 13 and 15 (most placements), then 14, then the rest.
3. Hand over as before, with a short `.md` per batch (file, sha256, size check, previews). The game puts them in with
   `?art=tinfox` first, as it did with the figures and guns. It reports back with screenshots in `props/report/`.

## What the game will do (no action for the generator)

- `ArtSet` gets a prop-model override per prop id, like `weapons` for the pistol, so Kenney art stays as it is.
- Impact sounds go by the prop's `mat` (wood, metal…). The depot furniture turns from wood to metal, so the game
  updates `mat` along with it.
