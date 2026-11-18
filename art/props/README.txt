Tinfox prop sheets: one ChatGPT prompt per file.

For every prompt: start a new ChatGPT message, attach characters/sheets/01-guard.png and
weapons/sheets/01-pistol.png (style and palette), then paste the whole prompt file.
For 03-ammo-crate also attach weapons/sheets/06-ammo.png (it has to match the energy cells).

The practice dummy is a rigged, animated figure (it patrols, flinches and falls), so its
prompt is with the characters: characters/prompts/09-practice-dummy.txt. Attach the guard
sheet, as for 02-08.

Batch 1 (01-04). Sizes come from Tinfox (src/data/props.json, the training targets in src/sim/world.ts):
  01 explosive barrel  barrel_red    0.72 x 0.90 x 0.62 m, explodes when shot
  02 surprise box      surprise_box  0.80 m cube, breaks open for a random power-up
  03 ammo crate        ammo_crate    0.72 long x 0.57 deep x 0.28 high, a pickup you walk over
  04 range target      target        board radius 0.45 m (small: 0.26 m), hinge 0.90 m above
                                     the floor; the board tips back about its bottom edge

Notes for the generator:
- 04: the board and the post must be separate parts. The game turns the board about a
  "hinge" point at its bottom edge and needs a "board_centre" point; the small target is the
  same board scaled down to 0.26 m radius on the same post. Ring ratios matter: the game
  scores the bullseye at 28 % of the radius.
- 02: the box pops back in after 30 s, so a single static model is enough.

--- Batch 2: generic cover (05-08) and the Halvard Depot interior kit (09-20) ---

Attach, besides the guard and pistol sheets:
  05-08  props/sheets/03-ammo-crate.png (dark grey / orange: the villains' kit colours)
  06     also 05-supply-crate.png once approved (same family)
  08     also 01-explosive-barrel.png (the storage barrel has to look clearly different)
  09     nothing more; make the locker first, it sets the look of the kit
  10-20  also 09-locker.png once approved (one kit); 14 also 13-terminal.png

Sizes from Tinfox (src/data/props.json; width x height x depth, placements in brackets):
  05 supply crate      crate          0.97 x 0.93 x 0.93   (16: depot, training, snowfort, test room)
  06 large crate       crate_tall     1.55 x 1.41 x 1.54   (11)
  07 cargo container   cargo          2.90 x 1.41 x 1.55   (10)
  08 storage barrel    barrel         0.68 x 1.05 x 0.62   (21)
  09 locker            locker         0.71 x 1.92 x 0.36   (9: depot barracks, warehouse arena)
  10 supply shelf      shelf          1.03 x 2.00 x 0.41   (1)
  11 storage cabinet   shelf_wide     1.48 x 2.00 x 0.41   (5), also bookcase 1.10 x 2.02 x 0.40 (1)
  12 desk              lab_desk       2.27 x 0.75 x 0.82   (2), lab_desk_small 1.65 (4), desk 1.49 x 0.70 deep (2)
  13 terminal          terminal       0.90 x 1.30 x 0.60   (2, players use it)
  14 guidance console  console        1.40 x 1.20 x 0.70   (1, the mission target)
  15 bunk bed          bunk_bed       0.99 x ~1.65 x 2.04  (4)
  16 mess table        mess_table     1.28 x 0.74 x 2.50   (1)
  17 chair             chair          0.43 x 0.91 x 0.54   (4)
  18 office chair      office_chair   0.61 x 0.96 x 0.69   (2)
  19 armchair          armchair       1.07 x 0.88 x 0.94   (2)
  20 drawer cabinet    side_table     0.71 x 0.61 x 0.61   (1)

If time is short, the core is 05-09, 12, 13, 15 (about 80 of the 100 placements); 14 matters
because it is the mission target.

Save the approved sheets in props/sheets/ with the same numbers (01-explosive-barrel.png, ...),
and the dummy as characters/sheets/09-practice-dummy.png.

--- Batch 3: pickups (21-23), power-ups (24-29), last depot props (30-31) ---

Attach, besides the guard and pistol sheets:
  21-23  weapons/sheets/06-ammo.png (the pickups lie next to the ammo in the levels)
  22-23  also 21-medkit.png once approved (one family)
  24     props/sheets/02-surprise-box.png (the power-ups come out of it)
  25-29  also 24-zoom-boots.png once approved (one family); 28 also weapons/sheets/06-ammo.png
  30-31  props/sheets/09-locker.png (the depot kit)

Sizes (width x height x depth). Pickups and power-ups float and spin, so their size is a target,
not a collision box. The power-ups' glowing ring stays in the game's code: do not draw it.
  21 medkit          medkit         0.36 x 0.22 x 0.26   (2 in the depot, 2 per arena)
  22 vest            armor          0.40 x 0.46 x 0.16   (1 in the depot, 2 per arena)
  23 keycard         key_red        0.28 x 0.18 x 0.03   (1, the depot door); key_blue the same in blue
  24 zoom boots      power_speed    about 0.40 tall, yellow  #ffc93c
  25 bubble shield   power_shield   about 0.40 across, sky blue #5ec8ff
  26 double blast    power_damage   about 0.40 tall, red     #ff5a4a
  27 moon jump       power_jump     about 0.40 tall, green   #7ad36b
  28 full refill     power_refill   about 0.40 tall, orange  #ff9a3c
  29 shrink ray      power_shrink   about 0.40 tall, purple  #b77cff
  30 chest           chest          1.10 x 0.56 x 0.59   (1, depot)
  31 satellite dish  satellite_dish 1.38 x 4.34 x 2.08   (1, depot yard)

Each power-up keeps the colour the game already uses for it (HUD timer, ring, pickup text).
Medkit and refill show a heart, not a red cross (the red cross emblem is protected; the HUD
health icon is a heart already).

Save the approved sheets in props/sheets/ with the same numbers (21-medkit.png, ...).

--- Batch 4: alarm panel (32) ---

Attach, besides the guard and pistol sheets: props/sheets/13-terminal.png (the depot kit's
buttons and greys) and 01-explosive-barrel.png (the hazard stripe).

  32 alarm panel     alarm_panel    0.50 x 0.70 x 0.16   (5 in the depot, on walls; guards run to
                                    it, it can be shot), also start_panel (1, training)

Notes for the generator (otherwise the rules in COVER-AND-DEPOT.md):
- Front +Z, back flat: it hangs on a wall. Origin at the bottom centre of the box.
- Two named nodes, as an exception to "no named nodes": "button" (the red push button) and
  "lamp" (the red lamp with its dome). The game flashes "lamp" when the alarm is raised and
  tints "button" green for the training start panel, so each needs its own material
  (M_Button, M_Lamp); the rest stays on M_Palette.
- At most 400 triangles.

--- Batch 5: the Snowfort kit (33-39) ---

The Snowfort arena goes back to the Halvard Depot's world: a snowy yard instead of a castle. These
seven props replace the Kenney castle and nature models there (towers, banners, catapult, trees,
bushes, flowers, mushrooms, log piles). Walls, ground and fog are re-painted in the game's code.

Attach, besides the guard and pistol sheets:
  33-36  props/sheets/31-satellite-dish.png (the depot's snowy yard) and 05-supply-crate.png
  34-35  also 33-pine-tree.png once approved (one nature family: same greens and snow)
  36     also 33-pine-tree.png once approved (same snow caps)
  37-39  props/sheets/31-satellite-dish.png and 09-locker.png (the depot kit's greys and olive)
  39     also 37-watchtower.png once approved

Sizes (width x height x depth; placements in the Snowfort in brackets):
  33 pine tree      tree_castle, tree_oak, tree_round   about 2.2 x 3.4 x 2.2, trunk 0.35   (8)
  34 snowy bush     bush                                0.90 x 0.60 x 0.85                  (8)
  35 snowy rocks    flowers_red, flowers_yellow,        0.70 x 0.40 x 0.60                  (12)
                    mushrooms
  36 log pile       log_pile                            2.90 x 1.41 x 1.55                  (2)
  37 watchtower     tower_base + tower_mid + tower_top  2.40 x 8.08 x 2.40                  (2, corners)
  38 banner         banner                              0.75 x 2.60 x 0.05, hangs on a wall (4)
  39 snow tractor   catapult                            2.60 x 1.80 x 1.80                  (2)

Save the approved sheets in props/sheets/ with the same numbers (33-pine-tree.png, ...).
