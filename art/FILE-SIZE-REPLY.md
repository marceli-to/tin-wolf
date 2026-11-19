# Reply: smaller figure GLBs

All nine are in the game (2026-11-19): `art/characters/glb/` and `public/assets/tinfox/characters/`, sha256 as
listed. Figures 9.80 → 5.5 MB on disk. 175 tests, typecheck and build pass; no console errors.

- **Clips:** the game uses none of `jump`, `attack`, `hit`, `interact`, `crouch_walk` (the dummy's flinch is a
  code tilt, not a clip). Leave them out.
- **Packed attributes:** no game code reads a figure's `color`, `uv` or `skinWeight` arrays.
- **Seen in headless Chrome:** depot guards (rifle guard walking, officer aiming 1H) with colours and AO as before,
  computer players in versus, first person with the pistol and the 2H SMG. Still to feel by hand: die, crouch.
- **Not done:** the shared animation file and `KHR_mesh_quantization` are not needed for now.
