import { cellAt, floorAt, type Grid } from './grid';
import type { Box } from './collision';

export interface RayHit {
  t: number;
  nx: number;
  ny: number;
  nz: number;
}

export interface Ray {
  ox: number;
  oy: number;
  oz: number;
  /** Normalised direction. */
  dx: number;
  dy: number;
  dz: number;
}

/**
 * Ray against the level grid: walls, step faces, floors (including ramps) and ceilings.
 * Grid traversal (Amanatides & Woo) in xz; within each cell the floor and ceiling are planes,
 * so the vertical test is a linear solve between the cell's entry and exit points.
 */
export function rayGrid(grid: Grid, ray: Ray, maxT: number): RayHit | null {
  const { ox, oy, oz, dx, dy, dz } = ray;
  const s = grid.size;
  let cx = Math.floor(ox / s);
  let cz = Math.floor(oz / s);
  const stepX = dx > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? s / Math.abs(dx) : Infinity;
  const tDeltaZ = dz !== 0 ? s / Math.abs(dz) : Infinity;
  let tMaxX = dx > 0 ? ((cx + 1) * s - ox) / dx : dx < 0 ? (cx * s - ox) / dx : Infinity;
  let tMaxZ = dz > 0 ? ((cz + 1) * s - oz) / dz : dz < 0 ? (cz * s - oz) / dz : Infinity;
  let t0 = 0;
  let enx = 0;
  let enz = 0;
  for (let guard = 0; guard < 4096; guard++) {
    const t1 = Math.min(tMaxX, tMaxZ, maxT);
    const cell = cellAt(grid, cx, cz);
    if (!cell || cell.solid) return { t: t0, nx: enx, ny: 0, nz: enz };
    const ax = ox + dx * t0;
    const az = oz + dz * t0;
    const bx = ox + dx * t1;
    const bz = oz + dz * t1;
    const ya = oy + dy * t0;
    const yb = oy + dy * t1;
    const fA = ya - floorAt(grid, cell, cx, cz, ax, az);
    const fB = yb - floorAt(grid, cell, cx, cz, bx, bz);
    const cA = cell.ceil - ya;
    const cB = cell.ceil - yb;
    if (t0 > 0 && (fA < 0 || cA < 0)) return { t: t0, nx: enx, ny: 0, nz: enz };
    let best: RayHit | null = null;
    if (fA >= 0 && fB < 0) best = { t: t0 + ((t1 - t0) * fA) / (fA - fB), nx: 0, ny: 1, nz: 0 };
    if (cA >= 0 && cB < 0) {
      const tc = t0 + ((t1 - t0) * cA) / (cA - cB);
      if (!best || tc < best.t) best = { t: tc, nx: 0, ny: -1, nz: 0 };
    }
    if (best) return best;
    if (t1 >= maxT) return null;
    if (tMaxX < tMaxZ) {
      cx += stepX;
      t0 = tMaxX;
      tMaxX += tDeltaX;
      enx = -stepX;
      enz = 0;
    } else {
      cz += stepZ;
      t0 = tMaxZ;
      tMaxZ += tDeltaZ;
      enx = 0;
      enz = -stepZ;
    }
  }
  return null;
}

/** Slab test. Returns the entry hit, or null if the ray starts inside or misses. */
export function rayBox(ray: Ray, b: Box, maxT: number): RayHit | null {
  let tmin = 0;
  let tmax = maxT;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  const axes: [number, number, number, number, 0 | 1 | 2][] = [
    [ray.ox, ray.dx, b.minX, b.maxX, 0],
    [ray.oy, ray.dy, b.minY, b.maxY, 1],
    [ray.oz, ray.dz, b.minZ, b.maxZ, 2],
  ];
  for (const [o, d, lo, hi, axis] of axes) {
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let ta = (lo - o) / d;
    let tb = (hi - o) / d;
    let sign = -1;
    if (ta > tb) {
      const tmp = ta;
      ta = tb;
      tb = tmp;
      sign = 1;
    }
    if (ta > tmin) {
      tmin = ta;
      nx = axis === 0 ? sign : 0;
      ny = axis === 1 ? sign : 0;
      nz = axis === 2 ? sign : 0;
    }
    if (tb < tmax) tmax = tb;
    if (tmin > tmax) return null;
  }
  if (tmin <= 0) return null;
  return { t: tmin, nx, ny, nz };
}

/** Vertical cylinder (centre x/z, radius, y range) including its caps. */
export function rayCylinder(ray: Ray, cx: number, cz: number, r: number, y0: number, y1: number, maxT: number): number | null {
  let best = Infinity;
  const px = ray.ox - cx;
  const pz = ray.oz - cz;
  const a = ray.dx * ray.dx + ray.dz * ray.dz;
  if (a > 1e-12) {
    const b = 2 * (px * ray.dx + pz * ray.dz);
    const c = px * px + pz * pz - r * r;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0) {
        const y = ray.oy + ray.dy * t;
        if (y >= y0 && y <= y1) best = t;
      }
    }
  }
  if (Math.abs(ray.dy) > 1e-12) {
    for (const yc of [y0, y1]) {
      const t = (yc - ray.oy) / ray.dy;
      if (t < 0 || t >= best) continue;
      const qx = px + ray.dx * t;
      const qz = pz + ray.dz * t;
      if (qx * qx + qz * qz <= r * r) best = t;
    }
  }
  return best <= maxT ? best : null;
}
