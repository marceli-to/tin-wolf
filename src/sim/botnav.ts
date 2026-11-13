import { PLAYER, WORLD } from '../config';
import { cellAt, floorAtWorld } from './grid';
import type { Box } from './collision';
import type { World } from './world';

/**
 * Walk map for computer players. The guards' A* works on 2 m cells and ignores props; a bot in an
 * arena has to walk round crates and climb stairs onto catwalks. So the level is sampled every
 * RES metres, and each sample column keeps every surface a standing body fits on: the cell floor and
 * the tops of static props (stairs, catwalks, crates). Neighbouring surfaces connect when a body can
 * step up (at most a step) or drop down. Breakable props (barrels, surprise boxes) are left out:
 * they come and go, and a bot that bumps into one jumps.
 */
export const RES = 0.5;
/** Most surfaces one column can have (floor, stair, catwalk, ...). */
const MAX_FLOORS = 4;
/** Clearance kept round the body. */
const CLEAR = PLAYER.radius + 0.02;

export interface BotNav {
  w: number;
  h: number;
  /** Surface heights per column and slot (NaN = none), `(iz * w + ix) * MAX_FLOORS + f`. */
  floors: Float32Array;
  /** 1 where a standing body fits on that surface. */
  ok: Uint8Array;
}

export interface NavPoint {
  x: number;
  y: number;
  z: number;
}

const cache = new WeakMap<World['grid'], BotNav>();

/** The walk map for this world's level (built once per level and kept). */
export function botNav(world: World): BotNav {
  let nav = cache.get(world.grid);
  if (!nav) {
    nav = buildBotNav(world);
    cache.set(world.grid, nav);
  }
  return nav;
}

function staticBoxes(world: World): Box[] {
  return world.props.filter((p) => p.solid && !p.destructible).map((p) => p.box);
}

export function buildBotNav(world: World): BotNav {
  const grid = world.grid;
  const w = Math.ceil((grid.w * grid.size) / RES);
  const h = Math.ceil((grid.h * grid.size) / RES);
  const floors = new Float32Array(w * h * MAX_FLOORS).fill(NaN);
  const ok = new Uint8Array(w * h * MAX_FLOORS);
  const boxes = staticBoxes(world);
  // Bucket the boxes by 2 m cell so each column only tests the few nearby.
  const buckets = new Map<number, Box[]>();
  for (const b of boxes) {
    for (let cz = Math.floor((b.minZ - CLEAR) / grid.size); cz <= Math.floor((b.maxZ + CLEAR) / grid.size); cz++) {
      for (let cx = Math.floor((b.minX - CLEAR) / grid.size); cx <= Math.floor((b.maxX + CLEAR) / grid.size); cx++) {
        const k = cz * grid.w + cx;
        const list = buckets.get(k) ?? [];
        list.push(b);
        buckets.set(k, list);
      }
    }
  }
  const near = (x: number, z: number): Box[] => buckets.get(Math.floor(z / grid.size) * grid.w + Math.floor(x / grid.size)) ?? [];

  const fits = (x: number, y: number, z: number, local: Box[]): boolean => {
    for (const [ox, oz] of [[0, 0], [-CLEAR, -CLEAR], [CLEAR, -CLEAR], [-CLEAR, CLEAR], [CLEAR, CLEAR]] as const) {
      const px = x + ox;
      const pz = z + oz;
      const cell = cellAt(grid, Math.floor(px / grid.size), Math.floor(pz / grid.size));
      if (!cell || cell.solid || cell.ceil < y + PLAYER.height) return false;
      const f = floorAtWorld(grid, px, pz);
      if (f === null || f > y + WORLD.stepHeight) return false;
    }
    for (const b of local) {
      if (b.maxX <= x - CLEAR || b.minX >= x + CLEAR || b.maxZ <= z - CLEAR || b.minZ >= z + CLEAR) continue;
      if (b.minY < y + PLAYER.height && b.maxY > y + WORLD.stepHeight) return false;
    }
    return true;
  };

  for (let iz = 0; iz < h; iz++) {
    for (let ix = 0; ix < w; ix++) {
      const x = (ix + 0.5) * RES;
      const z = (iz + 0.5) * RES;
      const base = floorAtWorld(grid, x, z);
      if (base === null) continue;
      const local = near(x, z);
      const cand = [base];
      for (const b of local) if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && b.maxY > base + 0.05) cand.push(b.maxY);
      cand.sort((a, b) => a - b);
      let f = 0;
      for (let i = 0; i < cand.length && f < MAX_FLOORS; i++) {
        const y = cand[i]!;
        // Skip duplicates (stacked props) and surfaces buried inside another prop.
        if (i > 0 && y - cand[i - 1]! < 0.05) continue;
        if (local.some((b) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && b.minY < y + 0.05 && b.maxY > y + 0.05)) continue;
        const k = (iz * w + ix) * MAX_FLOORS + f++;
        floors[k] = y;
        ok[k] = fits(x, y, z, local) ? 1 : 0;
      }
    }
  }
  return { w, h, floors, ok };
}

/** The surface a body standing at height `y` in column (ix, iz) would be on, or -1. */
function landing(nav: BotNav, ix: number, iz: number, y: number): number {
  if (ix < 0 || iz < 0 || ix >= nav.w || iz >= nav.h) return -1;
  const base = (iz * nav.w + ix) * MAX_FLOORS;
  let best = -1;
  for (let f = 0; f < MAX_FLOORS; f++) {
    const fy = nav.floors[base + f]!;
    if (Number.isNaN(fy) || fy > y + WORLD.stepHeight) continue;
    if (best < 0 || fy > nav.floors[best]!) best = base + f;
  }
  return best;
}

/** Nearest usable node to a world point (searches a little way out if the point itself is blocked). */
export function nodeAt(nav: BotNav, x: number, y: number, z: number): number {
  const cx = Math.floor(x / RES);
  const cz = Math.floor(z / RES);
  for (let r = 0; r <= 3; r++) {
    let best = -1;
    let bestD = Infinity;
    for (let iz = cz - r; iz <= cz + r; iz++) {
      for (let ix = cx - r; ix <= cx + r; ix++) {
        if (Math.max(Math.abs(ix - cx), Math.abs(iz - cz)) !== r) continue;
        const k = landing(nav, ix, iz, y + 0.1);
        if (k < 0 || !nav.ok[k]) continue;
        const d = Math.hypot((ix + 0.5) * RES - x, (iz + 0.5) * RES - z) + Math.abs(nav.floors[k]! - y) * 2;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

export function nodePoint(nav: BotNav, k: number): NavPoint {
  const col = Math.floor(k / MAX_FLOORS);
  return { x: ((col % nav.w) + 0.5) * RES, y: nav.floors[k]!, z: (Math.floor(col / nav.w) + 0.5) * RES };
}

/** Where a body leaving node k toward column (ix, iz) ends up: a step, the same level, or a drop. */
function stepTo(nav: BotNav, k: number, ix: number, iz: number): number {
  const n = landing(nav, ix, iz, nav.floors[k]!);
  return n >= 0 && nav.ok[n] ? n : -1;
}

/** Binary min-heap of [f, node]. */
class Heap {
  private f: number[] = [];
  private k: number[] = [];
  get size(): number {
    return this.k.length;
  }
  push(f: number, k: number): void {
    this.f.push(f);
    this.k.push(k);
    let i = this.k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[p]! <= this.f[i]!) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.k[0]!;
    const lf = this.f.pop()!;
    const lk = this.k.pop()!;
    if (this.k.length) {
      this.f[0] = lf;
      this.k[0] = lk;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.k.length && this.f[l]! < this.f[m]!) m = l;
        if (r < this.k.length && this.f[r]! < this.f[m]!) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.f[a], this.f[b]] = [this.f[b]!, this.f[a]!];
    [this.k[a], this.k[b]] = [this.k[b]!, this.k[a]!];
  }
}

/** A* from one node to another; returns the nodes' points (start excluded), or null. */
export function findBotPath(nav: BotNav, from: number, to: number, maxNodes = 30000): NavPoint[] | null {
  if (from < 0 || to < 0) return null;
  if (from === to) return [nodePoint(nav, to)];
  const goal = nodePoint(nav, to);
  const g = new Map<number, number>([[from, 0]]);
  const came = new Map<number, number>();
  const closed = new Set<number>();
  const open = new Heap();
  open.push(0, from);
  let expanded = 0;
  while (open.size) {
    const cur = open.pop();
    if (cur === to) {
      const out: NavPoint[] = [];
      for (let k: number | undefined = to; k !== undefined && k !== from; k = came.get(k)) out.push(nodePoint(nav, k));
      return out.reverse();
    }
    if (closed.has(cur)) continue;
    closed.add(cur);
    if (++expanded > maxNodes) return null;
    const col = Math.floor(cur / MAX_FLOORS);
    const cx = col % nav.w;
    const cz = Math.floor(col / nav.w);
    const gc = g.get(cur)!;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const n = stepTo(nav, cur, cx + dx, cz + dz);
        if (n < 0 || closed.has(n)) continue;
        // Diagonals only where both straight steps work too (no cutting corners).
        if (dx && dz && (stepTo(nav, cur, cx + dx, cz) < 0 || stepTo(nav, cur, cx, cz + dz) < 0)) continue;
        const cost = gc + (dx && dz ? Math.SQRT2 : 1) * RES;
        if (cost >= (g.get(n) ?? Infinity)) continue;
        g.set(n, cost);
        came.set(n, cur);
        const p = nodePoint(nav, n);
        open.push(cost + Math.hypot(p.x - goal.x, p.z - goal.z) + Math.abs(p.y - goal.y), n);
      }
    }
  }
  return null;
}

/** Can a body walk straight from a to b on the same level (for skipping path corners)? */
export function walkableLine(nav: BotNav, a: NavPoint, b: NavPoint): boolean {
  if (Math.abs(a.y - b.y) > 0.05) return false;
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.ceil(d / (RES * 0.5));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    const k = landing(nav, Math.floor(x / RES), Math.floor(z / RES), a.y);
    if (k < 0 || !nav.ok[k] || Math.abs(nav.floors[k]! - a.y) > 0.05) return false;
  }
  return true;
}
