#!/usr/bin/env python3
"""Generates src/data/levels/dam.json: Kvitvann Dam, the second mission.

A dam in the Ostfjell range, seen from above (north is up, z grows southward):

  rows 1-5    the reservoir (water 2.5 m below the crest), with the intake tower and its bridge
  rows 6-12   the crest: the road along the top, the control house, the gatehouse at the east end
  rows 13-14  the downstream catwalk, 4 m below the crest, on the dam's valley face (the quiet route)
  rows 15-22  the valley, 22 m down with pines and rocks: only to look at
  cols 1-3    the arrival plaza in the west; cols 56-58 the road out in the east, behind the gate

Edges you could fall from get a concrete parapet 1.1 m high (a jump reaches 0.85 m). The reservoir has
service steps at its west end, so whoever ends up in the water can climb out. The valley cannot be reached.

Run: python3 tools/gen_dam.py
"""
import json
import random
from pathlib import Path

from levelkit import Kit, STEP, RUN

W, H = 60, 24  # cells (2 m each): 120 x 48 m
S = 2.0
WATER = -2.5
CATWALK = -4.0
VALLEY = -22.0
SKY = 7.0  # sky cells: ceiling for movement and rays (and the height of walls around them)
TOWER = 3.0  # intake tower top
GATEHOUSE = 3.0  # gatehouse roof
PARAPET = 1.1

OUT = Path(__file__).resolve().parent.parent / 'src/data/levels/dam.json'

kit = Kit(W, H, S)
g = kit.grid


def fill(c0, c1, r0, r1, ch):
    """Cells c0..c1, r0..r1 inclusive."""
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            g[r][c] = ch


fill(0, W - 1, 0, H - 1, 'R')
fill(4, 54, 1, 5, 'w')  # reservoir
fill(4, 54, 1, 1, 'W')  # its far edge: a low shore, so the water seems to go on into the fog
fill(38, 42, 1, 3, 't')  # intake tower
fill(39, 40, 5, 5, 'N')  # its bridge: a ramp up to the tower top
fill(39, 40, 4, 4, 'M')
fill(1, 3, 6, 14, 'p')  # arrival plaza
fill(4, 54, 6, 12, '.')  # crest
fill(4, 50, 13, 14, 'c')  # downstream catwalk
for i, ch in enumerate('4321'):  # west end: ramps up to the plaza (ascending west)
    fill(4 + i, 4 + i, 13, 14, ch)
for i, ch in enumerate('5678'):  # east end: ramps up to the landing (ascending east)
    fill(47 + i, 47 + i, 13, 14, ch)
fill(51, 51, 13, 14, '.')  # landing at crest level, beside the gatehouse
fill(1, 58, 15, 22, 'v')  # valley

# Control house: cols 22-33, rows 8-12 (walls on the outline); the road passes north of it.
fill(22, 33, 8, 12, '#')
fill(23, 25, 9, 11, 's')  # security room
fill(27, 32, 9, 10, 'i')  # switch hall
g[11][27] = 'i'  # head of the stair, level with the hall (a ramp top beside the hall would be a 0.5 m step)
for i, ch in enumerate('ABCE'):  # stair down to the turbine landing (ascending west)
    fill(28 + i, 28 + i, 11, 11, ch)
fill(32, 32, 11, 11, 'L')  # turbine landing, catwalk level
g[8][29] = 'd'  # front door, from the road
g[10][26] = 'd'  # security room door
g[12][32] = 'q'  # landing door, onto the catwalk

fill(52, 54, 10, 12, 'g')  # gatehouse (a rifle guard's post on the roof)
# Utility huts on the crest: solid cells under a small roof, so they are cover the grid (and the guards'
# pathfinding) knows about. Props would sit in the walking lanes.
HUTS = ((9, 10, 6), (16, 17, 12), (35, 36, 12), (45, 46, 6), (47, 48, 12))
for c0, c1, r in HUTS:
    fill(c0, c1, r, r, 'K')
fill(55, 55, 6, 12, 'X')  # gate wall
g[7][55] = 'D'  # the gate (keycard)
fill(56, 58, 6, 9, 'e')  # road out

# --- props in metres -------------------------------------------------------------------------------


def parapet(x0, x1, z0, z1, base, top=None):
    kit.box('parapet', x0, x1, z0, z1, base, (base + PARAPET) if top is None else top, mirror=False)


T = 0.3  # parapet thickness
# Crest, reservoir side (z = 12): gaps for the service steps (x 8-10) and the bridge (x 78-82).
parapet(10, 78, 12, 12 + T, 0)
parapet(82, 110, 12, 12 + T, 0)
# Crest, valley side (z = 26), west and east of the control house. Open above the catwalk ramps (x 8-16,
# 94-102): you may hop down onto them, and guards' pathfinding takes the short drops there.
parapet(16, 44, 26 - T, 26, 0)
parapet(68, 94, 26 - T, 26, 0)
# Valley edge (z = 30): a railing you can see the drop through (crouched you are 1.15 m, the bar is at
# 0.9-1.0 m, a jump lifts the feet 0.85 m: nobody gets under or over). Plaza, ramps, catwalk, ramps, landing.
RZ = 29.9
kit.railing(2, RZ, 8, RZ, 0, mirror=False)
for i in range(4):  # west ramps, cols 4-7: floor from -1..0 (col 4) down to -4..-3 (col 7), in 2 m pieces
    kit.railing(8 + i * S, RZ, 8 + (i + 1) * S, RZ, -i - 0.5, mirror=False)
kit.railing(16, RZ, 94, RZ, CATWALK, mirror=False)
for i in range(4):  # east ramps, cols 47-50: -4..-3 up to -1..0
    kit.railing(94 + i * S, RZ, 94 + (i + 1) * S, RZ, CATWALK + i + 0.5, mirror=False)
kit.railing(102, RZ, 104, RZ, 0, mirror=False)
# Intake tower top (x 76-86, z 2-8), open to the south where the stairs arrive (x 78-82).
parapet(76, 86, 2, 2 + T, TOWER)
parapet(76, 76 + T, 2, 8, TOWER)
parapet(86 - T, 86, 2, 8, TOWER)
parapet(76, 78, 8 - T, 8, TOWER)
parapet(82, 86, 8 - T, 8, TOWER)
# The bridge ramp: walls as high as its top, so nobody steps off into the water halfway up.
parapet(78, 78 + T, 8, 12, 0, TOWER + PARAPET)
parapet(82 - T, 82, 8, 12, 0, TOWER + PARAPET)
# The gatehouse roof has no way up: a rifle guard's post. Stairs there stood in every path to the gate.

# Service steps out of the reservoir at its west end (x 8-10), rising south to the crest at z = 12.
n = round(-WATER / STEP)
for i in range(n):
    top = WATER + STEP * (i + 1)
    z1 = 12 - RUN * (n - 1 - i)
    kit.box('stair', 8, 10, z1 - RUN, z1, WATER, min(top, 0), mirror=False)

add = kit.add
add({'type': 'playerStart', 'slot': 0, 'cell': [2, 9], 'yaw': 90}, mirror=False)

# Mission pieces (stand-ins until their own models arrive).
add({'type': 'pickup', 'item': 'key_blue', 'cell': [24, 10]}, mirror=False)
add({'type': 'prop', 'id': 'switchboard', 'kind': 'terminal', 'cell': [32.85, 11.0], 'yaw': 270}, mirror=False)
add({'type': 'prop', 'id': 'mast', 'kind': 'transmitter', 'cell': [40, 2], 'yaw': 180}, mirror=False)
add({'type': 'door', 'id': 'door_front', 'cell': [29, 8]}, mirror=False)
add({'type': 'door', 'id': 'door_security', 'cell': [26, 10]}, mirror=False)
add({'type': 'door', 'id': 'door_landing', 'cell': [32, 12]}, mirror=False)
add({'type': 'door', 'id': 'gate', 'cell': [55, 7], 'requires': 'key_blue', 'mat': 'door_blue'}, mirror=False)
add({'type': 'zone', 'id': 'exit', 'cell': [57, 6], 'size': [2, 4]}, mirror=False)

# Guards. Rifle guards (pale uniforms, SMGs) hold the high points: the intake tower, the gatehouse roof and
# the middle of the crest; basic guards patrol the crest and the catwalk; an officer keeps the security room;
# a worker minds the turbine landing. Reserves come through the east gate (and one from the plaza) on the alarm.
RIFLE = '#c9d1d8'
for gd in (
    {'id': 'c1', 'archetype': 'guard_basic', 'cell': [9, 8], 'yaw': 90, 'patrol': [[9, 8], [20, 8], [20, 11], [9, 11]]},
    {'id': 'c2', 'archetype': 'guard_rifle', 'cell': [36, 10], 'yaw': 270, 'uniform': RIFLE},
    {'id': 'c3', 'archetype': 'guard_rifle', 'cell': [40, 2], 'yaw': 180, 'uniform': RIFLE},
    {'id': 'c4', 'archetype': 'guard_basic', 'cell': [38, 8], 'yaw': 90, 'patrol': [[38, 8], [49, 8], [49, 10], [38, 10]]},
    {'id': 'c5', 'archetype': 'guard_rifle', 'cell': [53, 11], 'yaw': 270, 'uniform': RIFLE},
    {'id': 'c6', 'archetype': 'guard_basic', 'cell': [52, 7], 'yaw': 270},
    {'id': 'c7', 'archetype': 'guard_basic', 'cell': [22, 7], 'yaw': 90, 'patrol': [[22, 7], [34, 7]]},
    {'id': 'b1', 'archetype': 'guard_basic', 'cell': [41, 6], 'yaw': 0},
    {'id': 'h1', 'archetype': 'guard_officer', 'cell': [24, 10], 'yaw': 90},
    {'id': 'h2', 'archetype': 'guard_basic', 'cell': [27, 10], 'yaw': 90, 'patrol': [[27, 10], [32, 10]]},
    {'id': 'h3', 'archetype': 'guard_basic', 'cell': [32, 11], 'yaw': 270, 'look': 'worker'},
    {'id': 'k1', 'archetype': 'guard_basic', 'cell': [12, 13], 'yaw': 90, 'patrol': [[12, 13], [24, 14]]},
    {'id': 'k2', 'archetype': 'guard_basic', 'cell': [44, 14], 'yaw': 270, 'patrol': [[44, 14], [34, 13]]},
    {'id': 'rA', 'archetype': 'guard_basic', 'cell': [57, 8], 'yaw': 270, 'reserve': True},
    {'id': 'rB', 'archetype': 'guard_rifle', 'cell': [57, 7], 'yaw': 270, 'reserve': True, 'uniform': RIFLE},
    {'id': 'rC', 'archetype': 'guard_basic', 'cell': [2, 7], 'yaw': 90, 'reserve': True},
):
    add({'type': 'guard', **gd}, mirror=False)

# Alarm panels: the switch hall, the house's west wall (outside), the gate.
for aid, c, r, yaw in (('alarm_hall', 30.3, 9.06, 180), ('alarm_west', 21.94, 10, 270), ('alarm_gate', 54.94, 9.5, 270)):
    add({'type': 'prop', 'id': aid, 'kind': 'alarm_panel', 'cell': [c, r], 'yaw': yaw, 'elevation': 1.0}, mirror=False)

# Furniture, and the dish on the gatehouse roof. The crest's cover is the huts; the catwalk stays bare.
for e in (
    {'type': 'prop', 'kind': 'satellite_dish', 'cell': [53.5, 11.2], 'yaw': 270},
    # Control house: desk and lockers in the security room, gear in the hall.
    {'type': 'prop', 'kind': 'desk', 'cell': [23.6, 9.3], 'yaw': 180},
    {'type': 'prop', 'kind': 'office_chair', 'cell': [23.6, 9.9], 'yaw': 0},
    {'type': 'prop', 'kind': 'locker', 'cell': [25.6, 11.3], 'yaw': 0},
    {'type': 'prop', 'kind': 'shelf_wide', 'cell': [28, 9.15], 'yaw': 180},
    {'type': 'prop', 'kind': 'terminal', 'cell': [31.5, 9.2], 'yaw': 180},
):
    add(e, mirror=False)

# The valley floor: pines and snowy rocks, so the drop reads from the railing.
rnd = random.Random(7)
for i in range(26):
    c = 2 + rnd.random() * 55
    r = 15.6 + rnd.random() * 6.8
    kind = rnd.choice(('tree_round', 'tree_castle', 'tree_oak', 'tree_round', 'snowy_rocks'))
    add({'type': 'prop', 'kind': kind, 'cell': [round(c, 2), round(r, 2)], 'yaw': rnd.randrange(0, 360, 15)}, mirror=False)

for item, c, r in (
    ('weapon_sniper', 16, 13.5),
    ('ammo_pistol', 3, 7),
    ('ammo_rifle', 41, 1.5),
    # The Pelican is the find on the intake tower; orbs for it on the quiet catwalk and by the control house.
    ('weapon_pelican', 39, 2),
    ('ammo_shell', 34, 13.5),
    ('ammo_shell', 27, 7),
    ('ammo_pistol', 30, 9.5),
    ('medkit', 24, 11),
    ('medkit', 46, 13.5),
    ('armor', 53, 10.5),
):
    add({'type': 'pickup', 'item': item, 'cell': [c, r]}, mirror=False)

for c, r, level, radius in ((24, 10, 0.25, 4), (30, 10, 0.2, 5), (32, 11, 0.35, 4)):
    add({'type': 'light', 'cell': [c, r], 'level': level, 'radius': radius}, mirror=False)

# --- legend ----------------------------------------------------------------------------------------

sky = {'sky': True, 'ceil': SKY, 'wall': 'dam_face', 'step': 'dam_face'}
house = {'ceil': 3.5, 'wall': 'panel', 'ceilMat': 'ceiling'}
legend = {
    'R': {'solid': True, 'wall': 'dam_cliff'},
    '#': {'solid': True},
    'X': {'solid': True, 'wall': 'dam_face'},
    'K': {'solid': True, 'wall': 'dam_face'},
    '.': {'floor': 0, 'floorMat': 'dam_road', 'light': 1.0, **sky},
    'p': {'floor': 0, 'floorMat': 'snow', 'light': 1.0, **sky, 'wall': 'dam_cliff'},
    'e': {'floor': 0, 'floorMat': 'snow', 'light': 1.0, **sky, 'wall': 'dam_cliff'},
    'w': {'floor': WATER, 'floorMat': 'dam_water', 'light': 0.9, **sky, 'ceil': 3},
    'W': {'floor': WATER, 'floorMat': 'dam_water', 'light': 0.9, **sky, 'ceil': WATER + 0.6, 'wall': 'dam_cliff'},
    'c': {'floor': CATWALK, 'floorMat': 'grate', 'light': 0.8, **sky},
    'v': {'floor': VALLEY, 'floorMat': 'snow', 'light': 0.7, **sky, 'wall': 'dam_cliff', 'ceil': VALLEY + 6},
    't': {'floor': TOWER, 'floorMat': 'pump_plate', 'light': 1.0, **sky},
    'g': {'floor': GATEHOUSE, 'floorMat': 'pump_plate', 'light': 1.0, **sky},
    'N': {'ramp': 'n', 'floor': 0, 'floorTo': TOWER / 2, 'floorMat': 'grate', 'light': 1.0, **sky},
    'M': {'ramp': 'n', 'floor': TOWER / 2, 'floorTo': TOWER, 'floorMat': 'grate', 'light': 1.0, **sky},
    's': {'floor': 0, 'floorMat': 'carpet', 'light': 0.9, **house, 'ceil': 3},
    'i': {'floor': 0, 'floorMat': 'tile', 'light': 0.85, **house},
    'L': {'floor': CATWALK, 'floorMat': 'metal', 'light': 0.6, **house, 'wall': 'metal'},
    'd': {'floor': 0, 'floorMat': 'tile', 'light': 0.8, **house, 'ceil': 3},
    'q': {'floor': CATWALK, 'floorMat': 'metal', 'light': 0.6, **house, 'ceil': -1, 'wall': 'metal'},
    'D': {'floor': 0, 'floorMat': 'dam_road', 'light': 1.0, 'ceil': 3.5, 'wall': 'dam_face', 'ceilMat': 'concrete'},
}
for i, ch in enumerate('4321'):  # catwalk ramps, west: '1' is -1..0 (top), '4' is -4..-3
    lo = CATWALK + (3 - i)
    legend[ch] = {'ramp': 'w', 'floor': lo, 'floorTo': lo + 1, 'floorMat': 'grate', 'light': 0.85, **sky}
for i, ch in enumerate('5678'):  # catwalk ramps, east: '5' is -4..-3, '8' is -1..0 (top)
    lo = CATWALK + i
    legend[ch] = {'ramp': 'e', 'floor': lo, 'floorTo': lo + 1, 'floorMat': 'grate', 'light': 0.85, **sky}
for i, ch in enumerate('ABCE'):  # house stair, ascending west: 'A' is -1..0, 'E' is -4..-3
    lo = -1 - i
    legend[ch] = {'ramp': 'w', 'floor': lo, 'floorTo': lo + 1, 'floorMat': 'metal', 'light': 0.7, **house, 'wall': 'metal'}



def floor_at(c, r):
    """Floor height at an entity position (cell units; integers mean the cell centre), ramps included."""
    def split(v):
        if isinstance(v, int) or abs(v - round(v)) < 1e-9 and float(v).is_integer():
            return int(v), 0.5
        i = int(v // 1)
        return i, v - i
    ci, fx = split(c)
    ri, fz = split(r)
    d = legend[g[ri][ci]]
    lo, hi = d.get('floor', 0), d.get('floorTo', d.get('floor', 0))
    t = {'e': fx, 'w': 1 - fx, 's': fz, 'n': 1 - fz}.get(d.get('ramp'), 0)
    return lo + (hi - lo) * t


# Kit boxes carry absolute heights; the level format wants them above the floor under the box's centre.
for e in kit.entities:
    if e['type'] == 'prop' and 'size' in e:
        e['elevation'] = round(e['elevation'] - floor_at(*e['cell']), 4)

level = {
    'id': 'dam',
    'name': 'Kvitvann Dam',
    'mode': 'mission',
    'cellSize': S,
    'fog': {'color': '#c3ccd4', 'near': 30, 'far': 120},
    'legend': legend,
    'map': kit.map(),
    'roofs': [{'from': [c0, r], 'to': [c1, r], 'eave': 2.4, 'rise': 0.7, 'ridge': 'x', 'overhang': 0.3} for c0, c1, r in HUTS],
    'entities': kit.entities,
    'objectives': [
        {'id': 'o1', 'text': 'Take the blue keycard from the security room', 'type': 'collect', 'target': 'key_blue'},
        {'id': 'o2', 'text': 'Cut the power at the switchboard below the control house', 'type': 'interact', 'target': 'switchboard'},
        {'id': 'o3', 'text': 'Destroy the transmitter on the intake tower', 'type': 'destroy', 'target': 'mast', 'requires': ['o2']},
        {'id': 'o4', 'text': 'Leave through the east gate', 'type': 'reach', 'target': 'exit', 'requires': ['o1', 'o3']},
    ],
    'briefing': (
        'The console at Halvard Depot was only the prototype. The real transmitter stands on Kvitvann Dam, '
        'steering test drones over the valley on power from the dam\'s turbines.\n\n'
        'Cut the power at the switchboard below the control house, then destroy the transmitter on the intake '
        'tower. The blue keycard for the east gate is in the security room. The crest road is quick and wide '
        'open; a service catwalk runs four metres lower along the valley face and comes up into the control house.'
    ),
    'loadout': ['pistol_sd', 'pistol'],
}
OUT.write_text(json.dumps(level, indent=1) + '\n')
print(f'wrote {OUT} ({len(kit.entities)} entities)')
