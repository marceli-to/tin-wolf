# Pickups, power-ups and the last depot props: handoff for the generator

Eleven static models, none rigged. They replace the box shapes the game builds in code for its pickups and
power-ups (`src/render/pickups.ts`) and the last two Kenney models in the Halvard Depot. Prompts:
`props/prompts/21`–`31`; sizes and attachments: `props/README.txt` (batch 3). Paths are relative to `art/` in the Tin Fox repo.
The sheets come first (Marcel makes them in ChatGPT). Start on a GLB once its sheet is approved.

## What the game needs in each GLB

Same conventions as the cover and depot kit (`COVER-AND-DEPOT.md`): metres, +Y up, front +Z, the palette material
`M_Palette` with vertex AO in `COLOR_0`, one material per model, no animation, no named nodes.

**Pickups and power-ups (21–29)** float about 0.45 m above the floor, bob and spin about their vertical axis:

- **Origin:** anywhere. The game centres the model's bounding box on the pickup point.
- **Size:** the target in the table, in metres, so the game can load it at scale 1. It is not a collision box:
  pickups are taken by walking over them, whatever the model's size.
- **Upright:** the side the sheet shows as FRONT faces +Z, standing the way it is drawn. Spinning shows every side,
  so there is no back to skimp on.
- **Triangles:** at most 600 each (a level has up to about 20 pickups plus the power-ups from the boxes).
- **No glow ring.** The power-ups' ring under the model stays in code (it takes the power-up's colour and fades).
- **Bubble shield (25):** the bubble is part of the model and stays opaque in `M_Palette`. If the bubble has to be
  see-through, put it in a second material named `M_Bubble` (the game makes that one translucent); that would be
  the only model with two materials.

**Keycard (23):** two files, `keycard-red.glb` and `keycard-blue.glb`, the same model. Only the card face changes
colour (red `#d33a2c`, blue `#3a6bd3`); frame, stripe and chip stay the same. That way the game doesn't tint the
whole model.

**Chest and satellite dish (30, 31)** are placed props like the depot kit: origin at floor level in the centre of the
footprint, exactly the box in the table (the game stretches the chest to its box; the dish's footprint is fitted).

| # | File | Game id | Size X × Y × Z (m) | Notes |
|---|---|---|---|---|
| 21 | `medkit.glb` | `medkit` | 0.36 × 0.22 × 0.26 | heart on front and back |
| 22 | `vest.glb` | `armor` | 0.40 × 0.46 × 0.16 | standing upright |
| 23 | `keycard-red.glb`, `keycard-blue.glb` | `key_red`, `key_blue` | 0.28 × 0.18 × 0.03 | standing on its long edge |
| 24 | `power-speed.glb` | `power_speed` | about 0.40 high | |
| 25 | `power-shield.glb` | `power_shield` | about 0.40 across | see the bubble note |
| 26 | `power-damage.glb` | `power_damage` | about 0.40 high | "x2" on front and back, so it reads while spinning |
| 27 | `power-jump.glb` | `power_jump` | about 0.40 high | |
| 28 | `power-refill.glb` | `power_refill` | about 0.40 high | |
| 29 | `power-shrink.glb` | `power_shrink` | about 0.40 high | |
| 30 | `chest.glb` | `chest` | 1.10 × 0.56 × 0.59 | front: long side with the latches; max 600 triangles |
| 31 | `satellite-dish.glb` | `satellite_dish` | 1.38 × 4.34 × 2.08 | dish facing +Z, tilted up; max 1,500 triangles |

## Order

1. Sheets 21, then 22–23; 24, then 25–29; 30–31 whenever.
2. GLBs in the same order. The power-ups are the most visible part for the kids (every surprise box), the medkit and
   vest come next (every arena).
3. Hand over as before, with a short `.md` per batch (file, sha256, size check, previews). The game puts them in with
   `?art=tinfox` first and reports back with screenshots in `props/report/`.

## What the game will do (no action for the generator)

- Pickups and keycards go into `ArtSet.items`, like the weapon and ammo pickups.
- Power-ups: the ring stays, the code-built shape is swapped for the model.
- Chest and dish go into `ArtSet.props`, like the cover kit.
