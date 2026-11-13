#!/usr/bin/env python3
"""Generates src/data/levels/training.json.

The course runs from the start in the south up the field: warm-up targets on the west side, the
grenade pit in the middle, a few targets on the east side. A raised shooting deck (3 m) crosses the
field, with stairs at both ends. From the deck you shoot the long range to the north: moving
targets, far targets and two on a 4.5 m tower in the north-west corner, with distance markers
every 10 m. You can walk under the deck,
and up the tower's stairs. Five practice dummies (worker outfit) patrol the stations, under the deck
and the long range; they never fire and count toward the course like targets.

Run: python3 tools/gen_training.py
"""
import json
from pathlib import Path

from levelkit import Kit

W, H = 36, 46  # cells (2 m each): 72 x 92 m
DECK = 3.0
TOWER = 4.5

OUT = Path(__file__).resolve().parent.parent / 'src/data/levels/training.json'

kit = Kit(W, H, 2.0)
kit.border('R')
for row in kit.grid[1:-1]:
    for c in range(1, W - 1):
        row[c] = 's'

# --- shooting deck: x 8..64, z 44..48 m --------------------------------------------------------
kit.slab(8, 64, 44, 48, DECK)
kit.stairs(48, 8, 12, 's', DECK)
kit.stairs(48, 60, 64, 's', DECK)
kit.railing(8, 44.04, 64, 44.04, DECK)
kit.railing(12, 47.96, 60, 47.96, DECK)
kit.railing(8.04, 44, 8.04, 48, DECK)
kit.railing(63.96, 44, 63.96, 48, DECK)
for x in (16, 26, 36, 46, 56):
    kit.support(x, 46, DECK)

# --- tower in the north-west: x 8..16, z 6..12 m, stairs down to the east ----------------------
kit.slab(8, 16, 6, 12, TOWER)
kit.stairs(16, 6, 10, 'e', TOWER)
kit.railing(8, 6.04, 16, 6.04, TOWER)
kit.railing(8.04, 6, 8.04, 12, TOWER)
for x, z in ((8.4, 6.4), (15.6, 6.4), (8.4, 11.6), (15.6, 11.6)):
    kit.support(x, z, TOWER)

# --- start --------------------------------------------------------------------------------------
add = kit.add
add({'type': 'playerStart', 'slot': 0, 'cell': [17, 43], 'yaw': 0})
add({'type': 'playerStart', 'slot': 1, 'cell': [19, 43], 'yaw': 0})
add({'type': 'spawn', 'cell': [17, 43], 'yaw': 0})
add({'type': 'spawn', 'cell': [19, 43], 'yaw': 0})
add({'type': 'prop', 'kind': 'crate_tall', 'cell': [15, 41]})
add({'type': 'prop', 'kind': 'start_panel', 'cell': [15, 41.925], 'id': 'course_start', 'yaw': 0, 'elevation': 0.55})


def target(c, r, size='big', elevation=0, to=None, speed=None):
    e = {'type': 'target', 'cell': [c, r], 'yaw': 180, 'size': size}
    if elevation:
        e['elevation'] = elevation
    if to:
        e['to'] = to
        e['speed'] = speed
    add(e)


# Station 1, west: warm-up, two of them up on crates.
target(4, 33)
target(8, 32)
target(5, 30, 'small')
add({'type': 'prop', 'kind': 'crate', 'cell': [9, 28]})
target(9, 28, elevation=0.93)
add({'type': 'prop', 'kind': 'crate', 'cell': [3, 27]})
target(3, 27, 'small', elevation=0.93)

# Station 2, middle: the grenade pit, three small targets fully behind tall crates.
for c in (17, 18, 19):
    add({'type': 'prop', 'kind': 'crate_tall', 'cell': [c, 33]})
target(17, 31.5, 'small')
target(18.5, 31, 'small')
target(19, 31.5, 'small')

# Station 3, east.
target(25, 30)
target(29, 28)
target(27, 26, 'small')

# Long range, shot from the deck.
target(4, 15, to=[20, 15], speed=2.5)
target(20, 9, 'small', to=[32, 9], speed=3.5)
target(10, 11)
target(26, 14)
target(22, 5, 'small')
target(33, 3, 'small')
target(4, 5, elevation=TOWER)
target(6, 5, 'small', elevation=TOWER)

# Distance markers across the long range, measured from a shooter at the deck railing (z = 45 m):
# a painted line and a sign at each end at 10, 20, 30 and 40 m.
for metres in (10, 20, 30, 40):
    r = (45 - metres) / 2  # cell row whose centre lies `metres` north of the shooter
    add({'type': 'marker', 'text': f'{metres} m', 'cell': [18, int(r)], 'yaw': 180, 'width': 55})

# Practice dummies (guard_dummy: they patrol and flinch, never fire). Part of the course.
for i, (a, b) in enumerate((
    ([3, 37], [12, 37]),  # behind the warm-up targets
    ([22, 36], [33, 36]),  # east station
    ([7, 23], [28, 23]),  # under the deck
    ([5, 17], [28, 17]),  # long range, just north of the deck
    ([17, 7], [28, 7]),  # far end
), 1):
    add({'type': 'guard', 'id': f'dummy_{i}', 'archetype': 'guard_dummy', 'look': 'worker', 'cell': a, 'yaw': 90, 'patrol': [b, a]})
# Cover and set dressing.
for e in (
    {'type': 'prop', 'kind': 'barrel', 'cell': [1, 41]},
    {'type': 'prop', 'kind': 'barrel', 'cell': [34, 41]},
    {'type': 'prop', 'kind': 'crate', 'cell': [26, 40]},
    {'type': 'prop', 'kind': 'crate', 'cell': [27, 40]},
    {'type': 'prop', 'kind': 'cargo', 'cell': [32, 31], 'yaw': 90},
    {'type': 'prop', 'kind': 'crate', 'cell': [12, 35]},
    {'type': 'prop', 'kind': 'barrel', 'cell': [23, 34]},
    {'type': 'prop', 'kind': 'barrel_red', 'cell': [6, 35]},
    {'type': 'prop', 'kind': 'barrel_red', 'cell': [27, 29]},
    {'type': 'prop', 'kind': 'crate_tall', 'cell': [30, 20]},
    {'type': 'prop', 'kind': 'cargo', 'cell': [14, 19]},
    {'type': 'prop', 'kind': 'crate', 'cell': [24, 22]},
    {'type': 'prop', 'kind': 'barrel', 'cell': [3, 18]},
    {'type': 'prop', 'kind': 'crate_tall', 'cell': [33, 12]},
):
    add(e)

level = {
    'id': 'training',
    'name': 'Training Ground',
    'mode': 'training',
    'cellSize': 2,
    'fog': {'color': '#b9c8d6', 'near': 50, 'far': 140},
    'legend': {
        'R': {'solid': True, 'wall': 'rock'},
        's': {'floor': 0, 'ceil': 7, 'sky': True, 'floorMat': 'snow', 'wall': 'rock', 'light': 1.0},
    },
    'loadout': ['pistol', 'pistol_sd', 'smg', 'sniper', 'grenade'],
    'map': kit.map(),
    'entities': kit.entities,
}
OUT.write_text(json.dumps(level, indent=1) + '\n')
targets = sum(1 for e in kit.entities if e['type'] == 'target')
print(f'wrote {OUT} ({len(kit.entities)} entities, {targets} targets)')
