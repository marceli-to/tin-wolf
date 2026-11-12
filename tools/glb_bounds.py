#!/usr/bin/env python3
"""Print the bounding box size (x, y, z) of each .glb given, including node transforms.

Usage: python3 tools/glb_bounds.py model.glb [...]
"""
import json, math, struct, sys

def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]

def trs(n):
    if 'matrix' in n:
        m = n['matrix']
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    tx, ty, tz = n.get('translation', [0, 0, 0])
    x, y, z, w = n.get('rotation', [0, 0, 0, 1])
    sx, sy, sz = n.get('scale', [1, 1, 1])
    r = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[r[0][0] * sx, r[0][1] * sy, r[0][2] * sz, tx], [r[1][0] * sx, r[1][1] * sy, r[1][2] * sz, ty],
            [r[2][0] * sx, r[2][1] * sy, r[2][2] * sz, tz], [0, 0, 0, 1]]

def bounds(path):
    f = open(path, 'rb').read()
    l = struct.unpack('<I', f[12:16])[0]
    g = json.loads(f[20:20 + l])
    lo, hi = [math.inf] * 3, [-math.inf] * 3
    def visit(i, m):
        n = g['nodes'][i]
        m = mat_mul(m, trs(n))
        if 'mesh' in n:
            for p in g['meshes'][n['mesh']]['primitives']:
                a = g['accessors'][p['attributes']['POSITION']]
                mn, mx = a['min'], a['max']
                for cx in (mn[0], mx[0]):
                    for cy in (mn[1], mx[1]):
                        for cz in (mn[2], mx[2]):
                            v = [m[r][0] * cx + m[r][1] * cy + m[r][2] * cz + m[r][3] for r in range(3)]
                            for k in range(3):
                                lo[k] = min(lo[k], v[k]); hi[k] = max(hi[k], v[k])
        for c in n.get('children', []):
            visit(c, m)
    ident = [[1 if r == c else 0 for c in range(4)] for r in range(4)]
    for root in g['scenes'][g.get('scene', 0)]['nodes']:
        visit(root, ident)
    return [hi[k] - lo[k] for k in range(3)], lo, hi

for p in sys.argv[1:]:
    size, lo, hi = bounds(p)
    print(f"{p.split('/')[-1]:32s} size {[round(v, 2) for v in size]}  center x {round((lo[0] + hi[0]) / 2, 2)} z {round((lo[2] + hi[2]) / 2, 2)} minY {round(lo[1], 2)}")
