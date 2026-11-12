import { rayBox, rayGrid } from './raycast';
import type { World } from './world';

/** True if nothing solid (level, props, closed doors) lies between the two points. */
export function clearLine(world: World, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-6) return true;
  const ray = { ox: ax, oy: ay, oz: az, dx: dx / d, dy: dy / d, dz: dz / d };
  if (rayGrid(world.grid, ray, d)) return false;
  for (const b of world.terrain.boxes) if (rayBox(ray, b, d)) return false;
  return true;
}
