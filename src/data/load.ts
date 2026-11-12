import type { z } from 'zod';
import {
  EnemiesSchema,
  ItemsSchema,
  LevelSchema,
  PropKindsSchema,
  WeaponsSchema,
  type LevelDef,
} from './schema';

export class DataError extends Error {}

function formatIssues(source: string, err: z.ZodError): string {
  const lines = err.issues.map((i) => `  ${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`);
  return `Invalid data in ${source}:\n${lines.join('\n')}`;
}

function parse<S extends z.ZodType>(schema: S, raw: unknown, source: string): z.output<S> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new DataError(formatIssues(source, r.error));
  return r.data;
}

/** Parses a level and checks the map against the legend so mistakes name row and column. */
export function parseLevel(raw: unknown, source = 'level'): LevelDef {
  const level = parse(LevelSchema, raw, source);
  const width = level.map[0]!.length;
  const problems: string[] = [];
  level.map.forEach((row, r) => {
    if (row.length !== width) problems.push(`  map.${r}: row has ${row.length} chars, expected ${width}`);
    [...row].forEach((ch, c) => {
      if (!(ch in level.legend)) problems.push(`  map.${r}: char '${ch}' at column ${c} is not in legend`);
    });
  });
  for (const [ch, def] of Object.entries(level.legend)) {
    if (def.ramp && def.floorTo === undefined) problems.push(`  legend.${ch}.floorTo: ramp needs floorTo`);
  }
  level.entities.forEach((e, i) => {
    const [c, r] = e.cell;
    if (c < 0 || r < 0 || c >= width || r >= level.map.length) problems.push(`  entities.${i}.cell: [${c}, ${r}] is outside the map`);
  });
  if (problems.length) throw new DataError(`Invalid data in ${source}:\n${problems.join('\n')}`);
  return level;
}

export const parseWeapons = (raw: unknown) => parse(WeaponsSchema, raw, 'weapons.json');
export const parseEnemies = (raw: unknown) => parse(EnemiesSchema, raw, 'enemies.json');
export const parseItems = (raw: unknown) => parse(ItemsSchema, raw, 'items.json');
export const parseProps = (raw: unknown) => parse(PropKindsSchema, raw, 'props.json');
