import { WORLD } from '../config';
import { cellAt, floorAt, type Grid } from './grid';

export interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface Body {
  x: number;
  y: number;
  z: number;
  vy: number;
  radius: number;
  height: number;
  grounded: boolean;
}

export interface Terrain {
  grid: Grid;
  boxes: readonly Box[];
}

/** Does cell (cx, cz), sampled at point (px, pz), block a body standing at feetY? */
export function cellBlocks(grid: Grid, cx: number, cz: number, px: number, pz: number, feetY: number, height: number): boolean {
  const cell = cellAt(grid, cx, cz);
  if (!cell || cell.solid) return true;
  const f = floorAt(grid, cell, cx, cz, px, pz);
  if (f - feetY > WORLD.stepHeight) return true;
  return cell.ceil - Math.max(f, feetY) < height;
}

function boxBlocks(b: Box, feetY: number, height: number): boolean {
  return b.minY < feetY + height && b.maxY - feetY > WORLD.stepHeight;
}

function pushOut(body: Body, minX: number, maxX: number, minZ: number, maxZ: number): void {
  const px = body.x < minX ? minX : body.x > maxX ? maxX : body.x;
  const pz = body.z < minZ ? minZ : body.z > maxZ ? maxZ : body.z;
  const dx = body.x - px;
  const dz = body.z - pz;
  const d2 = dx * dx + dz * dz;
  const r = body.radius;
  if (d2 >= r * r) return;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    const k = (r - d) / d;
    body.x += dx * k;
    body.z += dz * k;
    return;
  }
  // Centre inside the rectangle: leave along the shallowest axis.
  const left = body.x - minX;
  const right = maxX - body.x;
  const up = body.z - minZ;
  const down = maxZ - body.z;
  const m = Math.min(left, right, up, down);
  if (m === left) body.x = minX - r;
  else if (m === right) body.x = maxX + r;
  else if (m === up) body.z = minZ - r;
  else body.z = maxZ + r;
}

/** Pushes the body out of every blocking cell and box it overlaps. */
export function resolveBody(t: Terrain, body: Body): void {
  const s = t.grid.size;
  for (let iter = 0; iter < 2; iter++) {
    const ccx = Math.floor(body.x / s);
    const ccz = Math.floor(body.z / s);
    for (let oz = -1; oz <= 1; oz++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oz === 0) continue;
        const cx = ccx + ox;
        const cz = ccz + oz;
        const minX = cx * s;
        const minZ = cz * s;
        const px = Math.min(Math.max(body.x, minX), minX + s);
        const pz = Math.min(Math.max(body.z, minZ), minZ + s);
        const dx = body.x - px;
        const dz = body.z - pz;
        if (dx * dx + dz * dz >= body.radius * body.radius) continue;
        if (!cellBlocks(t.grid, cx, cz, px, pz, body.y, body.height)) continue;
        pushOut(body, minX, minX + s, minZ, minZ + s);
      }
    }
    for (const b of t.boxes) {
      if (!boxBlocks(b, body.y, body.height)) continue;
      pushOut(body, b.minX, b.maxX, b.minZ, b.maxZ);
    }
  }
}

/** Moves horizontally in sub-steps so fast bodies cannot tunnel through thin geometry. */
export function moveBody(t: Terrain, body: Body, dx: number, dz: number): void {
  const maxStep = body.radius * WORLD.maxStepFraction;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / maxStep));
  const sx = dx / steps;
  const sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    body.x += sx;
    body.z += sz;
    resolveBody(t, body);
  }
}

/** Highest walkable surface under the body's footprint. */
export function groundHeight(t: Terrain, body: Body): number {
  const s = t.grid.size;
  const ccx = Math.floor(body.x / s);
  const ccz = Math.floor(body.z / s);
  let g = -Infinity;
  for (let oz = -1; oz <= 1; oz++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = ccx + ox;
      const cz = ccz + oz;
      const cell = cellAt(t.grid, cx, cz);
      if (!cell || cell.solid) continue;
      const minX = cx * s;
      const minZ = cz * s;
      const px = Math.min(Math.max(body.x, minX), minX + s);
      const pz = Math.min(Math.max(body.z, minZ), minZ + s);
      const dx = body.x - px;
      const dz = body.z - pz;
      if (dx * dx + dz * dz >= body.radius * body.radius * 0.8) continue;
      if (ox !== 0 || oz !== 0) {
        if (cellBlocks(t.grid, cx, cz, px, pz, body.y, body.height)) continue;
      }
      const f = floorAt(t.grid, cell, cx, cz, px, pz);
      if (f > g) g = f;
    }
  }
  for (const b of t.boxes) {
    if (b.maxY - body.y > WORLD.stepHeight || b.maxY > body.y + 0.01 + WORLD.stepHeight) continue;
    const px = Math.min(Math.max(body.x, b.minX), b.maxX);
    const pz = Math.min(Math.max(body.z, b.minZ), b.maxZ);
    const dx = body.x - px;
    const dz = body.z - pz;
    if (dx * dx + dz * dz >= body.radius * body.radius * 0.8) continue;
    if (b.maxY > g) g = b.maxY;
  }
  return g === -Infinity ? body.y : g;
}

/** Gravity, step-up and snapping down slopes and small steps. */
export function updateVertical(t: Terrain, body: Body, dt: number): void {
  const g = groundHeight(t, body);
  // Rising (a jump) leaves the ground; only snap to it while falling or standing.
  if (body.y <= g && body.vy <= 0) {
    body.y = g;
    body.vy = 0;
    body.grounded = true;
    return;
  }
  if (body.grounded && body.vy <= 0 && body.y - g <= WORLD.stepHeight + 0.05) {
    body.y = g;
    body.vy = 0;
    return;
  }
  body.vy -= WORLD.gravity * dt;
  body.y += body.vy * dt;
  if (body.y <= g) {
    body.y = g;
    body.vy = 0;
    body.grounded = true;
  } else {
    body.grounded = false;
  }
}

/** Is there room above the body's feet for `height` at its current position? */
export function hasHeadroom(t: Terrain, body: Body, height: number): boolean {
  const s = t.grid.size;
  const ccx = Math.floor(body.x / s);
  const ccz = Math.floor(body.z / s);
  for (let oz = -1; oz <= 1; oz++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = ccx + ox;
      const cz = ccz + oz;
      const minX = cx * s;
      const minZ = cz * s;
      const px = Math.min(Math.max(body.x, minX), minX + s);
      const pz = Math.min(Math.max(body.z, minZ), minZ + s);
      const dx = body.x - px;
      const dz = body.z - pz;
      if ((ox !== 0 || oz !== 0) && dx * dx + dz * dz >= body.radius * body.radius) continue;
      const cell = cellAt(t.grid, cx, cz);
      if (!cell || cell.solid) continue;
      if (cell.ceil - body.y < height) return false;
    }
  }
  for (const b of t.boxes) {
    if (b.minY < body.y + 0.01 || b.minY >= body.y + height) continue;
    const px = Math.min(Math.max(body.x, b.minX), b.maxX);
    const pz = Math.min(Math.max(body.z, b.minZ), b.maxZ);
    const dx = body.x - px;
    const dz = body.z - pz;
    if (dx * dx + dz * dz < body.radius * body.radius) return false;
  }
  return true;
}

/** Pushes two overlapping bodies apart, half each, then re-resolves against the level. */
export function separateBodies(t: Terrain, a: Body, b: Body): void {
  if (a.y + a.height < b.y || b.y + b.height < a.y) return;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const r = a.radius + b.radius;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  const d = Math.sqrt(d2) || 1e-4;
  const push = (r - d) / 2;
  const nx = d2 > 1e-8 ? dx / d : 1;
  const nz = d2 > 1e-8 ? dz / d : 0;
  moveBody(t, a, -nx * push, -nz * push);
  moveBody(t, b, nx * push, nz * push);
}
