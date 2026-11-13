#!/usr/bin/env python3
"""Generates src/data/levels/arena_warehouse.json.

The Warehouse has a second level built from walkable props: a mezzanine along the north and south
walls, a bridge between them with a platform in the middle, stairs and railings. Placing that many
boxes by hand is error-prone, so this script does it. Everything is point-symmetric around the map
centre: define one half, the other is mirrored.

Run: python3 tools/gen_warehouse.py
"""
import json
from pathlib import Path

from levelkit import Kit

W, H = 35, 29  # cells (2 m each): 70 x 58 m
S = 2.0
TOP = 3.0  # walking height of the mezzanine, bridge and platform

OUT = Path(__file__).resolve().parent.parent / 'src/data/levels/arena_warehouse.json'

kit = Kit(W, H, S, mirror=True)
kit.border('B')  # outer walls: calm pastel; the cover blocks inside keep the toy bricks
put = kit.put

# Loading dock in the north-east corner, 1.2 m up, with a ramp from the west.
for r in range(1, 5):
    for c in range(25, 34):
        put(c, r, 'p')
for r in (1, 2):
    put(24, r, '>')
# Floor-to-ceiling cover blocks (kept clear of column 17, which the bridge crosses).
for c0, r0 in ((6, 7), (11, 12), (26, 7), (4, 14), (21, 9)):
    for dc in (0, 1):
        for dr in (0, 1):
            put(c0 + dc, r0 + dr, '#')

# --- second level (in metres) --------------------------------------------------------------------

# North mezzanine (mirrored to the south): x 2..44, z 2..6.
kit.slab(2, 44, 2, 6, TOP)
kit.stairs(44, 2, 6, 'e', TOP)  # down to the east, beside the dock ramp
kit.stairs(6, 2, 6, 's', TOP)  # down to the south, at the west wall
kit.railing(6, 5.96, 34, 5.96, TOP)
kit.railing(36, 5.96, 44, 5.96, TOP)
for x in (10, 18, 26, 41):
    kit.support(x, 5.7, TOP)

# Bridge from the mezzanine to the centre platform (x 34..36), mirrored for the south half.
kit.slab(34, 36, 6, 26, TOP)
kit.railing(34.04, 6, 34.04, 26, TOP)
kit.railing(35.96, 6, 35.96, 26, TOP)
for z in (13, 20):
    kit.support(35, z, TOP)

# Centre platform, 6 x 6 m; the half-geometry is mirrored, so define it once and not mirror the slab.
kit.slab(32, 38, 26, 32, TOP, mirror=False)
kit.railing(32, 26.04, 34, 26.04, TOP)
kit.railing(36, 26.04, 38, 26.04, TOP)
kit.railing(32.04, 26, 32.04, 32, TOP)
kit.support(32.4, 26.4, TOP)
kit.support(37.6, 26.4, TOP)

# --- the rest: spawns, pickups, cover, lights ---------------------------------------------------


add = kit.add
entities = kit.entities


add({'type': 'playerStart', 'slot': 0, 'cell': [3, 11], 'yaw': 90}, mirror=False)
add({'type': 'playerStart', 'slot': 1, 'cell': [31, 17], 'yaw': 270}, mirror=False)
for c, r, yaw, elev in ((3, 11, 90, 0), (13, 6, 180, 0), (30, 10, 225, 0), (24, 4, 180, 0), (5, 1, 135, TOP), (29, 3, 225, 0)):
    e = {'type': 'spawn', 'cell': [c, r], 'yaw': yaw}
    if elev:
        e['elevation'] = elev
    add(e)

def pickup(item, c, r, respawn, elev=0, mirror=True):
    e = {'type': 'pickup', 'item': item, 'cell': [c, r], 'respawn': respawn}
    if elev:
        e['elevation'] = elev
    add(e, mirror)

pickup('weapon_sniper', 17, 14, 30, TOP, mirror=False)
pickup('weapon_smg', 9, 10, 30)
pickup('medkit', 2, 8, 30)
pickup('armor', 12, 1, 45, TOP)
pickup('grenades', 14, 9, 40)
pickup('ammo_pistol', 8, 14, 20)
pickup('ammo_smg', 20, 3, 20)
pickup('ammo_rifle', 30, 2, 20)
pickup('ammo_rifle', 19, 2, 20, TOP)

for e in (
    # Toy factory: machines along the west wall (mirrored to the east).
    {'type': 'prop', 'kind': 'toy_hopper', 'cell': [1.4, 16.3]},
    {'type': 'prop', 'kind': 'toy_machine', 'cell': [1.4, 20.5], 'yaw': 90},
    {'type': 'prop', 'kind': 'shelf_wide', 'cell': [8.5, 1.2]},
    {'type': 'prop', 'kind': 'shelf_wide', 'cell': [14.5, 1.2]},
    {'type': 'prop', 'kind': 'locker', 'cell': [19.6, 1.2]},
    # Toy blocks instead of crates: A (small), B (tall), C (long), 1 (big).
    {'type': 'prop', 'kind': 'toy_block_a', 'cell': [9, 3]},
    {'type': 'prop', 'kind': 'toy_block_b', 'cell': [14.6, 11.4]},
    {'type': 'prop', 'kind': 'toy_block_1', 'cell': [24, 13], 'yaw': 90},
    {'type': 'prop', 'kind': 'toy_block_1', 'cell': [10, 18]},
    {'type': 'prop', 'kind': 'toy_block_a', 'cell': [28, 6]},
    {'type': 'prop', 'kind': 'toy_block_c', 'cell': [3, 6.5]},
    {'type': 'prop', 'kind': 'toy_block_a', 'cell': [27, 2]},
    {'type': 'prop', 'kind': 'toy_block_b', 'cell': [32.3, 3.3]},
    {'type': 'prop', 'kind': 'toy_drum', 'cell': [16.4, 4.4]},
    {'type': 'prop', 'kind': 'toy_drum', 'cell': [7.6, 12.3]},
    {'type': 'prop', 'kind': 'barrel_red', 'cell': [10, 5]},
    {'type': 'prop', 'kind': 'barrel_red', 'cell': [20, 11]},
    {'type': 'prop', 'kind': 'barrel_red', 'cell': [2, 13]},
    # Surprise boxes: one on the floor, one up on the raised east platform (each mirrored).
    {'type': 'prop', 'kind': 'surprise_box', 'cell': [7, 4]},
    {'type': 'prop', 'kind': 'surprise_box', 'cell': [32, 4]},
    {'type': 'light', 'cell': [5, 4], 'level': 0.25, 'radius': 5},
    {'type': 'light', 'cell': [17, 9], 'level': 0.2, 'radius': 6},
    {'type': 'light', 'cell': [29, 2], 'level': 0.2, 'radius': 5},
):
    add(e, yaw_flip=False)

# Toy factory look: toy-brick walls, a checkered floor, a yellow studded dock, candy-striped edges.
legend_base = {'ceil': 7, 'wall': 'toy_wall', 'ceilMat': 'toy_ceil'}
level = {
    'id': 'arena_warehouse',
    'name': 'Toy Factory',
    'mode': 'versus',
    'cellSize': S,
    'fog': {'color': '#f3d9ff', 'near': 22, 'far': 80},
    # Catwalks, stairs, railings and supports are shared prop kinds; paint them in toy colours here.
    'retexture': {'grate': 'toy_plank', 'metal': 'toy_yellow', 'hazard': 'toy_candy'},
    'match': {'killLimit': 10, 'timeLimit': 360},
    'legend': {
        '#': {'solid': True, 'wall': 'toy_bricks', 'wallInside': True},
        'B': {'solid': True, 'wall': 'toy_wall'},
        '.': {'floor': 0, 'floorMat': 'toy_floor', 'light': 0.95, **legend_base},
        'p': {'floor': 1.2, 'floorMat': 'toy_top', 'light': 1.0, 'step': 'toy_candy', **legend_base},
        '>': {'ramp': 'e', 'floor': 0, 'floorTo': 1.2, 'floorMat': 'toy_top', 'light': 0.95, 'step': 'toy_candy', **legend_base},
        '<': {'ramp': 'w', 'floor': 0, 'floorTo': 1.2, 'floorMat': 'toy_top', 'light': 0.95, 'step': 'toy_candy', **legend_base},
    },
    'map': kit.map(),
    'entities': entities,
}
OUT.write_text(json.dumps(level, indent=1) + '\n')
print(f'wrote {OUT} ({len(entities)} entities)')
