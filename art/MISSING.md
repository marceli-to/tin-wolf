# What is still missing (as of 2026-11-18)

Everything Tin Fox still draws with Kenney models or code-built boxes (Tin Fox's own art is the only look now), in the order the game needs
it. Paths are relative to `art/` in the Tin Fox repo. Rules for every GLB: `COVER-AND-DEPOT.md` (props) and
`PICKUPS-AND-POWERUPS.md` (pickups, power-ups). Put finished GLBs in `props/glb/` with a preview and a
`-vs-sheet.png` as before, plus a short handoff `.md` (file, sha256, size check).

## 1. Depot kit: done

All of 05–20 is in the game (2026-11-18). The depot uses no Kenney furniture under `?art=tinfox`.

## 2. Pickups, power-ups, chest, dish: done

All of 21–31 is in the game (2026-11-18).

## 3. Alarm panel: done

In the game since 2026-11-18.

Walls, floors, ceilings and doors are not models: they are textures drawn in the game's code.

## 4. Figures (the worker is in; players' sheets ready, GLBs open)

| # | Sheet | What | Notes |
|---|---|---|---|
| 05–08 | `characters/sheets/05`–`08-player-*.png` | the four players | seen by the others in split-screen and versus |
| 09 | `characters/sheets/09-practice-dummy.png`, brief `PRACTICE-DUMMY.md` | practice dummy (training) | rigged: patrols, flinches, falls |

First-person arms are built in the game from a figure GLB (the guard stands in now, screenshots `characters/report/fp1-*`); with the player GLBs they switch to the player's sleeves and gloves, no extra asset needed.

## 5. Snowfort kit (prompts written, sheets open)

| # | Prompt | Replaces (Kenney) | Placements |
|---|---|---|---|
| 33 | `props/prompts/33-pine-tree.txt` | three tree kinds | 8 |
| 34 | `props/prompts/34-snowy-bush.txt` | bush | 8 |
| 35 | `props/prompts/35-snowy-rocks.txt` | flowers, mushrooms | 12 |
| 36 | `props/prompts/36-log-pile.txt` | log pile | 2 |
| 37 | `props/prompts/37-watchtower.txt` | the stacked castle towers | 2 |
| 38 | `props/prompts/38-banner.txt` | castle banners | 4 |
| 39 | `props/prompts/39-snow-tractor.txt` | catapult | 2 |

Sizes and attachments: batch 5 in `props/README.txt`; GLB rules: `SNOWFORT.md`. The Pumphouse and the Warehouse need no
new models: they use the cover and depot props (in the game since 2026-11-18).

## Not needed

`crate_large`, `barrel_small`, `closet`, `shelf_low`, `lab_chair` and `stool` exist in the game's data but are placed
nowhere.

## When GLBs arrive

Tell the Tin Fox thread. The game wires them into its art set (props via `ArtSet.props`, pickups via `ArtSet.items`,
power-ups keep their code-built ring) and reports back with screenshots in `props/report/`.
