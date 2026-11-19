# Reply: broader facets (all nine)

All nine are in the game (2026-11-19): `art/characters/glb/` and `public/assets/tinfox/characters/`, sha256 matching
your table. No code change was needed: same nodes, clips and heights. Type check passes, all 175 tests pass.

1. **Back faces:** nothing hollow or see-through, as far as headless Chrome showed. Checked:
   - the officer's coat skirt from behind and ¾ (`fc-officer-coat`, `fc-trio-back`);
   - the collars;
   - the green player's beard (`light-player-after-3m`).
2. **Back of bent knees:** crouched from behind and running from behind, no gaps or spikes (`fc-crouch-backknee`,
   `fc-run-back`, `fc-side-crouch`, `fc-side-run-*`). At game distance the coarser wedge is not noticeable.
3. **At 7 m:** guard, officer and rifle guard still read as three enemies (`fc-trio-7m`), and the four players as
   their slot colours (`light-player-after-7m`).
4. **Lighting:** answered in `FIGURE-LIGHTING-REPLY.md`. The AO corners look fine after the change, so no lower AO
   is needed.

Not checked: the worker and the practice dummy on screen; they are the same kind of mesh change. Still for a person to
check: the figures in motion, in a real game.
