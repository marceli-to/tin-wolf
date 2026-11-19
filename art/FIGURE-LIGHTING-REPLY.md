# Reply: figure lighting

Done on the game side (2026-11-19), option 2 (a shadow floor in the material). No AO change needed from you.

## What changed

- `src/render/modelCharacter.ts`: `FIGURE_LIGHT = { color: 0.75, floor: 0.22 }`. Each figure's own materials (not the
  gun in hand, not props) get `emissiveMap` = their palette texture. Every frame:
  - `color` = base × level light × 0.75;
  - `emissive` = base × level light × 0.22.
  The level light is the baked value at the figure's spot, as before. So dark rooms stay dark, and the muzzle
  flash's point light still adds on top.
- The scene lights are unchanged: hemisphere `#dfe8f0` / `#4a443c` 1.5, sun 1.0. Props keep today's look.
- Profile: every figure drawn by `ModelCharacter`. That is all of them, since `tinfox` is the only art set: guards,
  officer, rifle guard, worker, players, computer players and the dummy.
- Not changed: the first-person sleeves. They have their own light rig in the view-model scene; tell us if
  they look off next to the others.
- In debug mode, `window.__game.figureLight` holds both values for live tuning.

## Measured

This is the guard's olive in the depot, darkest (5th percentile) to brightest (95th percentile). Only the guard's
own pixels are counted: each shot is compared with the same shot taken without the guard.

| Spot (level light) | Before | After |
|---|---|---|
| Corridor, bright (0.91), 3 m | `#151807` → `#434722` · 30 % | `#363918` → `#4D5226` · 69 % |
| Corridor, bright, 7 m | `#161706` → `#444822` · 29 % | `#353817` → `#4D5227` · 67 % |
| Barracks, dim (0.72), 3 m | `#151708` → `#494C24` · 28 % | `#313416` → `#4D5127` · 62 % |
| Darkest walkway (0.625), 3 m | `#131505` → `#434621` · 26 % | `#2E3113` → `#484C24` · 62 % |
| Darkest walkway, 7 m | `#121405` → `#40441F` · 26 % | `#2E3113` → `#474B23` · 63 % |

For reference, the sheet is `#525524` → `#6C722F` (~75 %). The brightest faces came up only a little, so figures
stay about as bright as the props around them. They are still darker than the sheet overall, because the level
lighting is darker.

## Checks

- **Slot colours:** blue, red, green and yellow read as their slot colours at 3 m and 7 m, more cleanly than before.
  Pictures: `light-player-*`, and `light-cmp-players` side by side.
- **Three enemies at 7 m:** they still read apart. The officer has the peaked cap and orange pads, the rifle guard
  the helmet and grey vest (`fc-trio-7m`).
- **Dark areas:** the figures don't glow. In the depot's darkest spots they come out as dim as the walls around them
  (`light-cmp-darkest`). None of the levels is lit darker than that; the dam's darkest spot is 0.85.

Screenshots in `characters/report/`: `light-guard-{before,after}-{bright,dark,darkest}-{3,7}m`, `light-player-*`,
`light-cmp-*`. The `dark-7m` pair is not in the table: another olive surface entered the frame and spoiled the
measurement.
