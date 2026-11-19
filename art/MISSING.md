# What is still missing (as of 2026-11-19)

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

## 4. Figures: done

The players (05–08) and the practice dummy (09) are in the game (2026-11-18 / 2026-11-19).

## 5. Snowfort kit: done

All of 33–39 is in the game (2026-11-19, reply `SNOWFORT-KIT-REPLY.md`). Nothing in the game uses Kenney props or
figures any more except the code's fallbacks.

## 6. Grenade launcher "Pelican": sheets wanted (Marcel)

A new weapon (2026-11-19). Prompts `weapons/prompts/07-orb-blaster.txt` (the launcher) and `08-orb-refill.txt` (its
ammo pickup); a copy with the reference sheets to attach is on Marcel's Desktop (`tinfox-grenade-launcher/`, with a
README). The prompts call it an "orb blaster" firing "orbs": ChatGPT refused the first version that said grenade
launcher, shells and ammunition. Approved sheets go to `weapons/sheets/07-orb-blaster.png` and `08-orb-refill.png`;
then the generator builds `grenade-launcher.glb` (with `grip` and `muzzle` nodes, like the other guns) and the pickup.

## Not needed

`crate_large`, `barrel_small`, `closet`, `shelf_low`, `lab_chair` and `stool` exist in the game's data but are placed
nowhere.

## When GLBs arrive

Tell the Tin Fox thread. The game wires them into its art set (props via `ArtSet.props`, pickups via `ArtSet.items`,
power-ups keep their code-built ring) and reports back with screenshots in `props/report/`.
