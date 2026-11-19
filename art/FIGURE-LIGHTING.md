# Figure lighting: closer to the sheets (brief for the tin-wolf agent)

From the generator side, 2026-11-19. Marcel wants the Tin Fox figures (guards, officer, rifle guard, worker,
players, practice dummy) to read with the soft, even shading of their sheets. We measured where the dark shading
comes from: **the light on the figures, not the models.** This change is on the game's side. No new GLBs come
with this brief.

## What we measured

Olive suit pixels on the guard, darkest (5th percentile) to brightest (95th percentile):

| | Darkest | Brightest | Darkest as % of brightest |
|---|---|---|---|
| Sheet `characters/sheets/01-guard.png` | `#525524` | `#6C722F` | ~75 % |
| Guard under a copy of your figure light | `#171E01` | `#555710` | ~25–35 % |
| Same guard with half the baked AO | `#100F00` | `#545812` | ~20–30 % |

- Halving the AO baked into the figure's vertex colours (`COLOR_0`) hardly moved the dark end.
- The spread comes from the light. On flat-shaded figures, every face that turns away from the sun and the sky
  drops towards the hemisphere's ground colour.
- Pictures:
  - `characters/lighting/guard-vs-sheet-game-light.png`: the sheet, then the shipped guard and two test versions
    under a copy of the game's light (front, ¾, head).
  - `characters/lighting/guard-dark-light.png`: the shipped guard and the soft-AO test version under a dark light.

## What your code does today (as we read it)

- `gameRenderer.ts` ~l. 220: `modelLights` = `HemisphereLight('#dfe8f0', '#4a443c', 1.5)` + `DirectionalLight('#fff4e0', 1.0)`
  at (0.4, 1, 0.3). Props and figures share it.
- Figures are `MeshStandardMaterial` (our GLBs: metallic 0, roughness default 1), with no environment map and no
  tone mapping.
- Then `m.light(min(1.1, light(x, z) + 0.15))` scales the base colour by the baked level light (`tintModel`).
- The dark brown ground colour `#4a443c` is what side and downward faces mostly get: sleeves under the pads, legs,
  the jaw, the sides of the torso.

## What we'd like

Figures shaded within roughly **60–75 % (darkest to brightest)** in a normally lit area, as on the sheet. They
should still react to the level: darker in dark rooms, with the muzzle flash still showing.

Options, your call (you know the levels and the performance):

1. **A separate light rig for figures**, not shared with props: a much lighter hemisphere ground colour (e.g.
   `#9a958a` instead of `#4a443c`) and a weaker sun (~0.5), with a higher hemisphere intensity to keep the overall
   brightness. Figures can be on their own layer so the props keep today's light.
2. **A shadow floor in the material:** `emissive` = the base colour × ~0.3 (or `emissiveMap` = the palette
   texture), tinted with `tintModel` like the colour, so the darkest face never falls below that floor.
3. Anything else that gets to the range above (e.g. `MeshLambertMaterial` with an ambient term).

Please check that:
- the players' slot colours still read as their slot colours;
- the guard, officer and rifle guard still read as three different enemies at 7 m;
- the dark levels (dusk, interiors) don't make figures glow.

## Coming next from us (separate handoff)

All figures are being rebuilt with fewer, broader faces (8-sided limbs instead of 14–20 sides): about 25 % fewer
triangles, same rig, clips and node names. If the AO corners look too dark after your lighting change, tell us
and we'll lower the baked AO in the same pass.

## Please report back

- What you changed (file, values) and for which art profile (`tinfox` only?).
- Screenshots of a guard and a player at 3 m and 7 m in one bright and one dark area, before and after
  (`characters/report/light-*`).
- If you measure it: darkest/brightest olive on the guard, as in the table above.
