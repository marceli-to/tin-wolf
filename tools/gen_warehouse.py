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

W, H = 35, 29  # cells (2 m each): 70 x 58 m
S = 2.0
MX, MZ = W * S, H * S
TOP = 3.0  # walking height of the mezzanine, bridge and platform
SLAB = 0.2
STEP = TOP / 8  # 0.375 m, under the 0.4 m step-up

OUT = Path(__file__).resolve().parent.parent / 'src/data/levels/arena_warehouse.json'


def mirror_cell(c, r):
    return (W - 1 - c, H - 1 - r) if isinstance(c, int) and isinstance(r, int) else (W - c, H - r)


# --- map -----------------------------------------------------------------------------------------
grid = [['.'] * W for _ in range(H)]
for x in range(W):
    grid[0][x] = grid[H - 1][x] = '#'
for z in range(H):
    grid[z][0] = grid[z][W - 1] = '#'


def put(c, r, ch):
    grid[r][c] = ch
    mc, mr = mirror_cell(c, r)
    mirrored = {'>': '<', '<': '>'}.get(ch, ch)
    grid[mr][mc] = mirrored


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

# --- boxes (in metres) ---------------------------------------------------------------------------
entities = []


def cell_coord(m):
    """Entity cell coordinate for a centre at m metres. Integer cells mean the cell centre."""
    c = m / S
    if abs(c - round(c) - 0.5) < 1e-9 or abs(c - round(c) + 0.5) < 1e-9:
        return int(round(c - 0.5))
    if abs(c - round(c)) < 1e-9:
        return round(c) + 1e-4  # a cell boundary; nudge so it is not read as a cell centre
    return round(c, 4)


def box(kind, x0, x1, z0, z1, y0, y1, mirror=True):
    for (a0, a1, b0, b1) in ((x0, x1, z0, z1),) + (((MX - x1, MX - x0, MZ - z1, MZ - z0),) if mirror else ()):
        entities.append({
            'type': 'prop', 'kind': kind,
            'cell': [cell_coord((a0 + a1) / 2), cell_coord((b0 + b1) / 2)],
            'size': [round(a1 - a0, 4), round(y1 - y0, 4), round(b1 - b0, 4)],
            'elevation': round(y0, 4),
        })


def slab(x0, x1, z0, z1, mirror=True):
    box('catwalk', x0, x1, z0, z1, TOP - SLAB, TOP, mirror)


def railing(x0, z0, x1, z1):
    """A rail along one axis at the walking height: posts about every 2 m and a top bar at 1 m."""
    t = 0.04
    if z0 == z1:
        box('railing', x0, x1, z0 - t, z0 + t, TOP + 0.9, TOP + 1.0)
        n = max(1, round((x1 - x0) / 2))
        for i in range(n + 1):
            x = min(max(x0 + (x1 - x0) * i / n, x0 + t), x1 - t)
            box('rail_post', x - t, x + t, z0 - t, z0 + t, TOP, TOP + 0.9)
    else:
        box('railing', x0 - t, x0 + t, z0, z1, TOP + 0.9, TOP + 1.0)
        n = max(1, round((z1 - z0) / 2))
        for i in range(n + 1):
            z = min(max(z0 + (z1 - z0) * i / n, z0 + t), z1 - t)
            box('rail_post', x0 - t, x0 + t, z - t, z + t, TOP, TOP + 0.9)


def stairs(x0, z0, x1, z1, down):
    """Seven solid steps from TOP down to the floor; `down` is the direction of descent (e/s)."""
    for i in range(1, 8):
        h = TOP - STEP * i
        if down == 'e':
            box('stair', x0 + 0.5 * (i - 1), x0 + 0.5 * i, z0, z1, 0, h)
        else:
            box('stair', x0, x1, z0 + 0.5 * (i - 1), z0 + 0.5 * i, 0, h)


def support(x, z):
    box('support', x - 0.2, x + 0.2, z - 0.2, z + 0.2, 0, TOP - SLAB)


# North mezzanine (mirrored to the south): x 2..44, z 2..6.
slab(2, 44, 2, 6)
stairs(44, 2, None, 6, 'e')  # down to the east, beside the dock ramp
stairs(2, 6, 6, None, 's')  # down to the south, at the west wall
railing(6, 5.96, 34, 5.96)
railing(36, 5.96, 44, 5.96)
for x in (10, 18, 26, 41):
    support(x, 5.7)

# Bridge from the mezzanine to the centre platform (x 34..36), mirrored for the south half.
slab(34, 36, 6, 26)
railing(34.04, 6, 34.04, 26)
railing(35.96, 6, 35.96, 26)
for z in (13, 20):
    support(35, z)

# Centre platform, 6 x 6 m; the half-geometry is mirrored, so define it once and not mirror the slab.
slab(32, 38, 26, 32, mirror=False)
railing(32, 26.04, 34, 26.04)
railing(36, 26.04, 38, 26.04)
railing(32.04, 26, 32.04, 32)
support(32.4, 26.4)
support(37.6, 26.4)

# --- the rest: spawns, pickups, cover, lights ---------------------------------------------------


def add(e, mirror=True, yaw_flip=True):
    entities.append(e)
    if not mirror:
        return
    m = dict(e)
    m['cell'] = list(mirror_cell(*e['cell']))
    if 'yaw' in m and yaw_flip:
        m['yaw'] = (m['yaw'] + 180) % 360
    entities.append(m)


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
    {'type': 'prop', 'kind': 'shelf_wide', 'cell': [8.5, 1.2]},
    {'type': 'prop', 'kind': 'shelf_wide', 'cell': [14.5, 1.2]},
    {'type': 'prop', 'kind': 'locker', 'cell': [19.6, 1.2]},
    {'type': 'prop', 'kind': 'crate', 'cell': [9, 3]},
    {'type': 'prop', 'kind': 'crate_tall', 'cell': [14.6, 11.4]},
    {'type': 'prop', 'kind': 'cargo', 'cell': [24, 13], 'yaw': 90},
    {'type': 'prop', 'kind': 'cargo', 'cell': [10, 18]},
    {'type': 'prop', 'kind': 'crate', 'cell': [28, 6]},
    {'type': 'prop', 'kind': 'crate_large', 'cell': [3, 6.5]},
    {'type': 'prop', 'kind': 'crate', 'cell': [27, 2]},
    {'type': 'prop', 'kind': 'crate_tall', 'cell': [32.3, 3.3]},
    {'type': 'prop', 'kind': 'barrel', 'cell': [16.4, 4.4]},
    {'type': 'prop', 'kind': 'barrel', 'cell': [7.6, 12.3]},
    {'type': 'prop', 'kind': 'barrel_red', 'cell': [10, 5]},
    {'type': 'prop', 'kind': 'barrel_red', 'cell': [20, 11]},
    {'type': 'prop', 'kind': 'barrel_red', 'cell': [2, 13]},
    {'type': 'light', 'cell': [5, 4], 'level': 0.25, 'radius': 5},
    {'type': 'light', 'cell': [17, 9], 'level': 0.2, 'radius': 6},
    {'type': 'light', 'cell': [29, 2], 'level': 0.2, 'radius': 5},
):
    add(e, yaw_flip=False)

legend_base = {'ceil': 7, 'wall': 'brick', 'ceilMat': 'ceiling'}
level = {
    'id': 'arena_warehouse',
    'name': 'Warehouse',
    'mode': 'versus',
    'cellSize': S,
    'fog': {'color': '#2a2f36', 'near': 22, 'far': 80},
    'match': {'killLimit': 10, 'timeLimit': 360},
    'legend': {
        '#': {'solid': True, 'wall': 'brick'},
        '.': {'floor': 0, 'floorMat': 'concrete', 'light': 0.9, **legend_base},
        'p': {'floor': 1.2, 'floorMat': 'metal', 'light': 1.0, 'step': 'hazard', **legend_base},
        '>': {'ramp': 'e', 'floor': 0, 'floorTo': 1.2, 'floorMat': 'metal', 'light': 0.95, 'step': 'hazard', **legend_base},
        '<': {'ramp': 'w', 'floor': 0, 'floorTo': 1.2, 'floorMat': 'metal', 'light': 0.95, 'step': 'hazard', **legend_base},
    },
    'map': [''.join(row) for row in grid],
    'entities': entities,
}
OUT.write_text(json.dumps(level, indent=1) + '\n')
print(f'wrote {OUT} ({len(entities)} entities)')
