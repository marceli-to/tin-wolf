import { PLAYER } from '../config';
import type { LevelDef } from '../data/schema';
import { buildGrid, cellAt } from './grid';
import { reachable } from './nav';

/**
 * Gameplay checks the schema cannot express: spawns reachable from each other (versus),
 * objectives and exit reachable from the start (mission). Doors count as passable.
 */
export function validateLevel(level: LevelDef): string[] {
  const grid = buildGrid(level);
  const problems: string[] = [];
  const opts = { height: PLAYER.crouchHeight };
  const cellOf = (c: [number, number]): [number, number] => [Math.floor(c[0]), Math.floor(c[1])];
  const at = (c: [number, number]) => cellAt(grid, ...cellOf(c));

  level.entities.forEach((e, i) => {
    if (e.type === 'zone') return;
    const c = at(e.cell);
    if (!c || c.solid) problems.push(`entities.${i} (${e.type}) is inside a solid cell at [${e.cell.join(', ')}]`);
  });

  if (level.mode === 'versus') {
    const spawns = level.entities.filter((e) => e.type === 'spawn');
    if (spawns.length < 4) problems.push(`versus maps need at least 4 spawns, found ${spawns.length}`);
    if (!level.match) problems.push('versus maps need a "match" block');
    spawns.forEach((a, i) => {
      const [ax, az] = cellOf(a.cell);
      const r = reachable(grid, ax, az, opts);
      spawns.forEach((b, j) => {
        if (i === j) return;
        const [bx, bz] = cellOf(b.cell);
        if (!r.has(bz * grid.w + bx)) problems.push(`spawn ${i} [${a.cell.join(', ')}] cannot reach spawn ${j} [${b.cell.join(', ')}]`);
      });
    });
  }

  if (level.mode === 'mission') {
    const start = level.entities.find((e) => e.type === 'playerStart' && e.slot === 0);
    if (!start) {
      problems.push('mission needs a playerStart for slot 0');
      return problems;
    }
    const [sx, sz] = cellOf(start.cell);
    const r = reachable(grid, sx, sz, opts);
    const reach = (c: [number, number]): boolean => {
      const [x, z] = cellOf(c);
      // Props sit inside open cells; reaching any neighbour is enough to use or shoot them.
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (r.has((z + dz) * grid.w + x + dx)) return true;
      return false;
    };
    for (const o of level.objectives) {
      const target = level.entities.find(
        (e) => ('id' in e && e.id === o.target) || (e.type === 'pickup' && e.item === o.target),
      );
      if (!target) {
        problems.push(`objective ${o.id}: target '${o.target}' does not exist`);
        continue;
      }
      if (!reach(target.cell)) problems.push(`objective ${o.id}: target '${o.target}' is not reachable from the start`);
      for (const req of o.requires) if (!level.objectives.some((x) => x.id === req)) problems.push(`objective ${o.id}: requires unknown '${req}'`);
    }
  }
  return problems;
}
