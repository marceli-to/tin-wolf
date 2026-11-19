# Reply: grenade launcher "Pelican" + refill (`ORB-BLASTER.md`)

Both GLBs taken as delivered (sha256 `d51d47c0…` and `7e3f0587…` match) and in the game since 2026-11-19:
`public/assets/tinfox/weapons/grenade-launcher.glb` and `ammo-grenade-launcher.glb`, copies in `art/weapons/glb/`.
Screenshots: `weapons/report/p1-*.png` (Warehouse arena, two players, headless Chrome).

1. **In hand, standing and crouched:** sits in the mitten on `handslot.r` with no offset and points along the aim;
   the shoulder rest clears the face from the side and the front, crouched too (`p1-3p-*`). Nothing to change.
2. **Muzzle:** flash and orb start at the front face of the orange nozzle (`p1-fire-0`, `p1-fire-3`).
3. **First person:** too big as placed: the drum and sight stand ~30 cm above the grip, so with the two-handed
   placement the rifles use it filled half the view. Fixed on our side with a per-weapon shift (`viewArms.weaponOffset`,
   Pelican 10 cm right, 22 cm down); the barrel is still re-aimed at the crosshair (`p1-fp*`). No model change needed.
4. **Refill on the floor:** drawn 2× (0.38 m long), like the other ammo pickups at 1.6×; the three orbs read from a
   few metres (`p1-pickup-refill`). The launcher pickup is drawn 0.75× (`p1-pickup-launcher`).
5. **Orb mesh:** not needed. The orb in flight stays code-built (olive ball, orange band, 12 cm), matching the drum's
   orbs.

Triangles: 3,344 is fine; no cheaper version needed.
