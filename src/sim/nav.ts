import { WORLD } from '../config';
import { cellAt, floorAt, type Grid } from './grid';

export interface NavOptions {
  /** Body height that must fit (players can crouch; guards cannot). */
  height: number;
  /** Extra blocker, e.g. locked doors. */
  blocked?: (cx: number, cz: number) => boolean;
}

/** Floor height of cell (cx, cz) at the midpoint of its edge toward (dx, dz). */
function edgeFloor(grid: Grid, cx: number, cz: number, dx: number, dz: number): number {
  const c = cellAt(grid, cx, cz)!;
  const s = grid.size;
  const x = (cx + 0.5 + dx * 0.5) * s;
  const z = (cz + 0.5 + dz * 0.5) * s;
  return floorAt(grid, c, cx, cz, x, z);
}

/** Can a body walk from cell A to the orthogonally adjacent cell B? Drops are allowed, climbs only up to a step. */
export function canStep(grid: Grid, ax: number, az: number, bx: number, bz: number, opts: NavOptions): boolean {
  const a = cellAt(grid, ax, az);
  const b = cellAt(grid, bx, bz);
  if (!a || !b || a.solid || b.solid) return false;
  if (opts.blocked?.(bx, bz)) return false;
  const dx = bx - ax;
  const dz = bz - az;
  const fa = edgeFloor(grid, ax, az, dx, dz);
  const fb = edgeFloor(grid, bx, bz, -dx, -dz);
  if (fb - fa > WORLD.stepHeight) return false;
  // The whole of B must also have headroom, not just the edge.
  const minFloorB = Math.max(b.floor, b.floorTo);
  if (Math.min(a.ceil, b.ceil) - Math.max(fa, fb) < opts.height) return false;
  if (b.ceil - minFloorB < opts.height) return false;
  return true;
}

const DIRS4: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** All cells reachable from (sx, sz), as a Set of `cz * w + cx`. */
export function reachable(grid: Grid, sx: number, sz: number, opts: NavOptions): Set<number> {
  const seen = new Set<number>([sz * grid.w + sx]);
  const queue: [number, number][] = [[sx, sz]];
  while (queue.length) {
    const [cx, cz] = queue.shift()!;
    for (const [dx, dz] of DIRS4) {
      const nx = cx + dx;
      const nz = cz + dz;
      const k = nz * grid.w + nx;
      if (seen.has(k) || !canStep(grid, cx, cz, nx, nz, opts)) continue;
      seen.add(k);
      queue.push([nx, nz]);
    }
  }
  return seen;
}

interface Node {
  k: number;
  g: number;
  f: number;
}

/**
 * A* over grid cells with 8-way moves (diagonals only when both orthogonal steps are possible).
 * Returns the list of cells from start to goal (inclusive), or null.
 */
export function findPath(grid: Grid, sx: number, sz: number, gx: number, gz: number, opts: NavOptions, maxNodes = 4000): [number, number][] | null {
  const w = grid.w;
  const start = sz * w + sx;
  const goal = gz * w + gx;
  if (start === goal) return [[sx, sz]];
  const gScore = new Map<number, number>([[start, 0]]);
  const came = new Map<number, number>();
  const open: Node[] = [{ k: start, g: 0, f: Math.hypot(gx - sx, gz - sz) }];
  const closed = new Set<number>();
  let expanded = 0;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[bi]!.f) bi = i;
    const cur = open.splice(bi, 1)[0]!;
    if (cur.k === goal) {
      const path: [number, number][] = [];
      let k: number | undefined = goal;
      while (k !== undefined) {
        path.push([k % w, Math.floor(k / w)]);
        k = came.get(k);
      }
      return path.reverse();
    }
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);
    if (++expanded > maxNodes) return null;
    const cx = cur.k % w;
    const cz = Math.floor(cur.k / w);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx;
        const nz = cz + dz;
        if (dx && dz) {
          if (!canStep(grid, cx, cz, nx, cz, opts) || !canStep(grid, cx, cz, cx, nz, opts)) continue;
          if (!canStep(grid, nx, cz, nx, nz, opts) || !canStep(grid, cx, nz, nx, nz, opts)) continue;
        } else if (!canStep(grid, cx, cz, nx, nz, opts)) continue;
        const nk = nz * w + nx;
        if (closed.has(nk)) continue;
        const g = cur.g + (dx && dz ? Math.SQRT2 : 1);
        if (g >= (gScore.get(nk) ?? Infinity)) continue;
        gScore.set(nk, g);
        came.set(nk, cur.k);
        open.push({ k: nk, g, f: g + Math.hypot(gx - nx, gz - nz) });
      }
    }
  }
  return null;
}
