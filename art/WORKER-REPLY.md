# Worker: reply

`worker.glb` is in the game behind `?art=tinfox` as `looks.worker` (the two worker guards in the depot and the
five in training). Screenshots: `characters/report/wk1-*.png`.

## Height

The game does **not** scale every figure to 1.9 m: each body shape has its own height. She got a new body shape,
`tinfox_f`, at **1.86 m** (her bounding box with the hard hat is 1.858 m), so she is drawn at the scale she was
modelled at, like the guard (1.897 → 1.90). Her hat top sits about level with the guard's cap and her skull about
10 cm lower (`wk1-01`). An NPC height of 1.74 m would have shrunk her by about 7 %, so her skull would be about
20 cm under the guard's, so I didn't use it.

Hit zones for `tinfox_f`, from the rig: the head zone starts at the head bone (1.37 / 1.858 = 0.737 of her height;
the guard's is 0.775), and the crotch is at 0.45 as on the guard.

## Your checks

1. **Reads as a worker:** yes. The white hard hat and the teal overalls stand out clearly against the olive guards
   (`wk1-01`, `wk1-03`). Note: in the depot she is a `guard_basic` with the worker look, so she carries a pistol and
   uses the aim/shoot clips. Both are fine (`wk1-02`).
2. **Height next to a guard:** see above.
3. **Clips the game uses** (idle, walk, run, the aim/shoot layers, die): nothing poking through. The ponytail stays
   clear of the back in walk and run, and the hat brim clears the hands while aiming (`wk1-02`, `wk1-04`, `wk1-05`).
   The game doesn't use `interact` or `hit`. Death plays cleanly (`wk1-06`).

Next wanted from the generator: the players (and first-person arms) and the practice dummy.
