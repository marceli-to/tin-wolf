import { cellAt, type Grid } from '../sim/grid';
import type { LevelDef } from '../data/schema';

export interface LampDef {
  x: number;
  z: number;
  level: number;
  radius: number;
}

export type LightField = (x: number, z: number) => number;

export function lampsFromLevel(level: LevelDef): LampDef[] {
  const s = level.cellSize;
  return level.entities
    .filter((e) => e.type === 'light')
    .map((e) => {
      const l = e as { cell: [number, number]; level: number; radius: number };
      const [c, r] = l.cell;
      return {
        x: Number.isInteger(c) ? (c + 0.5) * s : c * s,
        z: Number.isInteger(r) ? (r + 0.5) * s : r * s,
        level: l.level,
        radius: l.radius * s,
      };
    });
}

/**
 * Smooth light across the level: bilinear blend of open-cell light values at cell centres,
 * plus lamp contributions. Baked into vertex colours at build time.
 */
export function buildLightField(grid: Grid, lamps: readonly LampDef[]): LightField {
  const s = grid.size;
  const base = (x: number, z: number): number => {
    const fx = x / s - 0.5;
    const fz = z / s - 0.5;
    const c0 = Math.floor(fx);
    const r0 = Math.floor(fz);
    const tx = fx - c0;
    const tz = fz - r0;
    let sum = 0;
    let wsum = 0;
    for (const [dc, dr, w] of [
      [0, 0, (1 - tx) * (1 - tz)],
      [1, 0, tx * (1 - tz)],
      [0, 1, (1 - tx) * tz],
      [1, 1, tx * tz],
    ] as const) {
      const cell = cellAt(grid, c0 + dc, r0 + dr);
      if (!cell || cell.solid || w <= 0) continue;
      sum += cell.light * w;
      wsum += w;
    }
    if (wsum > 0) return sum / wsum;
    const own = cellAt(grid, Math.floor(x / s), Math.floor(z / s));
    return own && !own.solid ? own.light : 0.6;
  };
  return (x, z) => {
    let l = base(x, z);
    for (const lamp of lamps) {
      const d = Math.hypot(x - lamp.x, z - lamp.z);
      if (d < lamp.radius) {
        const f = 1 - d / lamp.radius;
        l += lamp.level * f * f;
      }
    }
    return Math.min(1.3, l);
  };
}
