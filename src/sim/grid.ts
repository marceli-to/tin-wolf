import type { LevelDef } from '../data/schema';

export type Dir = 'n' | 'e' | 's' | 'w';

export interface Cell {
  solid: boolean;
  floor: number;
  floorTo: number;
  ramp: Dir | null;
  ceil: number;
  sky: boolean;
  floorMat: string;
  ceilMat: string;
  wallMat: string;
  stepMat: string;
  /** Solid cells with an explicit wall material show it on every face. */
  wallExplicit: boolean;
  light: number;
}

export interface Grid {
  w: number;
  h: number;
  size: number;
  cells: Cell[];
}

export function buildGrid(level: LevelDef): Grid {
  const h = level.map.length;
  const w = level.map[0]!.length;
  const cells: Cell[] = [];
  for (const row of level.map) {
    for (const ch of row) {
      const d = level.legend[ch]!;
      cells.push({
        solid: d.solid,
        floor: d.floor,
        floorTo: d.floorTo ?? d.floor,
        ramp: d.ramp ?? null,
        ceil: d.ceil,
        sky: d.sky,
        floorMat: d.floorMat,
        ceilMat: d.ceilMat,
        wallMat: d.wall ?? 'concrete',
        stepMat: d.step ?? d.wall ?? 'concrete',
        wallExplicit: d.wall !== undefined,
        light: d.light,
      });
    }
  }
  return { w, h, size: level.cellSize, cells };
}

/** Null outside the map; callers treat that as solid. */
export function cellAt(grid: Grid, cx: number, cz: number): Cell | null {
  if (cx < 0 || cz < 0 || cx >= grid.w || cz >= grid.h) return null;
  return grid.cells[cz * grid.w + cx]!;
}

export function isOpen(grid: Grid, cx: number, cz: number): boolean {
  const c = cellAt(grid, cx, cz);
  return !!c && !c.solid;
}

/** Floor height of cell (cx, cz) at world point (x, z); the point is clamped into the cell. */
export function floorAt(grid: Grid, cell: Cell, cx: number, cz: number, x: number, z: number): number {
  if (!cell.ramp) return cell.floor;
  const s = grid.size;
  let t: number;
  switch (cell.ramp) {
    case 'e':
      t = (x - cx * s) / s;
      break;
    case 'w':
      t = 1 - (x - cx * s) / s;
      break;
    case 's':
      t = (z - cz * s) / s;
      break;
    case 'n':
      t = 1 - (z - cz * s) / s;
      break;
  }
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return cell.floor + (cell.floorTo - cell.floor) * t;
}

export function floorAtWorld(grid: Grid, x: number, z: number): number | null {
  const cx = Math.floor(x / grid.size);
  const cz = Math.floor(z / grid.size);
  const c = cellAt(grid, cx, cz);
  if (!c || c.solid) return null;
  return floorAt(grid, c, cx, cz, x, z);
}

export function cellCenter(grid: Grid, c: number, r: number): { x: number; z: number } {
  return { x: (c + 0.5) * grid.size, z: (r + 0.5) * grid.size };
}

export function worldToCell(grid: Grid, x: number, z: number): [number, number] {
  return [Math.floor(x / grid.size), Math.floor(z / grid.size)];
}
