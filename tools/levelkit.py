"""Helpers for level generator scripts (tools/gen_*.py).

A second level is built from walkable props: catwalk slabs, solid stair steps, railings and supports.
Coordinates are in metres; `Kit` turns them into prop entities with the right cell, size and
elevation. With `mirror=True` every box is also placed point-symmetrically around the map centre.
"""

STEP = 0.375  # stair rise, under the 0.4 m step-up
RUN = 0.5  # stair tread depth
SLAB = 0.2  # catwalk thickness


class Kit:
    def __init__(self, w, h, size=2.0, mirror=False):
        self.w, self.h, self.s = w, h, size
        self.mx, self.mz = w * size, h * size
        self.mirror = mirror
        self.entities = []
        self.grid = [['.'] * w for _ in range(h)]

    # --- map ----------------------------------------------------------------------------------

    def border(self, ch='#'):
        for x in range(self.w):
            self.grid[0][x] = self.grid[self.h - 1][x] = ch
        for z in range(self.h):
            self.grid[z][0] = self.grid[z][self.w - 1] = ch

    def mirror_cell(self, c, r):
        if isinstance(c, int) and isinstance(r, int):
            return (self.w - 1 - c, self.h - 1 - r)
        return (self.w - c, self.h - r)

    def put(self, c, r, ch):
        self.grid[r][c] = ch
        if self.mirror:
            mc, mr = self.mirror_cell(c, r)
            self.grid[mr][mc] = {'>': '<', '<': '>', '^': 'v', 'v': '^'}.get(ch, ch)

    def map(self):
        return [''.join(row) for row in self.grid]

    # --- entities -----------------------------------------------------------------------------

    def cell_coord(self, m):
        """Entity cell coordinate for a centre at m metres. Integer cells mean the cell centre."""
        c = m / self.s
        if abs((c - 0.5) - round(c - 0.5)) < 1e-9:
            return int(round(c - 0.5))
        if abs(c - round(c)) < 1e-9:
            return round(c) + 1e-4  # a cell boundary; nudge so it is not read as a cell centre
        return round(c, 4)

    def add(self, e, mirror=None, yaw_flip=True):
        """Adds an entity; mirrored (yaw turned by 180°) when the kit mirrors, unless mirror=False."""
        self.entities.append(e)
        if not (self.mirror if mirror is None else mirror):
            return
        m = dict(e)
        m['cell'] = list(self.mirror_cell(*e['cell']))
        if 'yaw' in m and yaw_flip:
            m['yaw'] = (m['yaw'] + 180) % 360
        self.entities.append(m)

    def box(self, kind, x0, x1, z0, z1, y0, y1, mirror=None):
        boxes = [(x0, x1, z0, z1)]
        if self.mirror if mirror is None else mirror:
            boxes.append((self.mx - x1, self.mx - x0, self.mz - z1, self.mz - z0))
        for a0, a1, b0, b1 in boxes:
            self.entities.append({
                'type': 'prop', 'kind': kind,
                'cell': [self.cell_coord((a0 + a1) / 2), self.cell_coord((b0 + b1) / 2)],
                'size': [round(a1 - a0, 4), round(y1 - y0, 4), round(b1 - b0, 4)],
                'elevation': round(y0, 4),
            })

    # --- second-level pieces ------------------------------------------------------------------

    def slab(self, x0, x1, z0, z1, top, mirror=None):
        self.box('catwalk', x0, x1, z0, z1, top - SLAB, top, mirror)

    def railing(self, x0, z0, x1, z1, top, mirror=None):
        """A rail along one axis at walking height `top`: posts about every 2 m, a bar at 1 m."""
        t = 0.04
        if z0 == z1:
            self.box('railing', x0, x1, z0 - t, z0 + t, top + 0.9, top + 1.0, mirror)
            n = max(1, round((x1 - x0) / 2))
            for i in range(n + 1):
                x = min(max(x0 + (x1 - x0) * i / n, x0 + t), x1 - t)
                self.box('rail_post', x - t, x + t, z0 - t, z0 + t, top, top + 0.9, mirror)
        else:
            self.box('railing', x0 - t, x0 + t, z0, z1, top + 0.9, top + 1.0, mirror)
            n = max(1, round((z1 - z0) / 2))
            for i in range(n + 1):
                z = min(max(z0 + (z1 - z0) * i / n, z0 + t), z1 - t)
                self.box('rail_post', x0 - t, x0 + t, z - t, z + t, top, top + 0.9, mirror)

    def stairs(self, edge, a0, a1, down, top, mirror=None):
        """Solid steps from `top` down to the floor, starting at a platform edge.

        `edge` is the edge's x (down = 'e'/'w') or z (down = 'n'/'s'); a0..a1 is the stair's extent
        along that edge. Returns the far end of the run.
        """
        n = round(top / STEP) - 1
        for i in range(1, n + 1):
            h = top - STEP * i
            near, far = RUN * (i - 1), RUN * i
            if down == 'e':
                self.box('stair', edge + near, edge + far, a0, a1, 0, h, mirror)
            elif down == 'w':
                self.box('stair', edge - far, edge - near, a0, a1, 0, h, mirror)
            elif down == 's':
                self.box('stair', a0, a1, edge + near, edge + far, 0, h, mirror)
            else:
                self.box('stair', a0, a1, edge - far, edge - near, 0, h, mirror)
        return {'e': edge + RUN * n, 'w': edge - RUN * n, 's': edge + RUN * n, 'n': edge - RUN * n}[down]

    def support(self, x, z, top, mirror=None):
        self.box('support', x - 0.2, x + 0.2, z - 0.2, z + 0.2, 0, top - SLAB, mirror)
