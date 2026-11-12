import enemiesJson from './enemies.json';
import itemsJson from './items.json';
import propsJson from './props.json';
import weaponsJson from './weapons.json';
import { parseEnemies, parseItems, parseLevel, parseProps, parseWeapons } from './load';
import type { EnemyDef, ItemDef, LevelDef, PropKindDef, WeaponDef } from './schema';

export interface GameData {
  weapons: Record<string, WeaponDef>;
  enemies: Record<string, EnemyDef>;
  items: Record<string, ItemDef>;
  props: Record<string, PropKindDef>;
}

export function loadGameData(): GameData {
  return {
    weapons: parseWeapons(weaponsJson),
    enemies: parseEnemies(enemiesJson),
    items: parseItems(itemsJson),
    props: parseProps(propsJson),
  };
}

const levelFiles = import.meta.glob<{ default: unknown }>('./levels/*.json', { eager: true });

export function levelIds(): string[] {
  return Object.keys(levelFiles).map((p) => p.replace(/^.*\/(.*)\.json$/, '$1'));
}

export function loadLevel(id: string): LevelDef {
  const file = levelFiles[`./levels/${id}.json`];
  if (!file) throw new Error(`Unknown level '${id}'. Known: ${levelIds().join(', ')}`);
  return parseLevel(file.default, `levels/${id}.json`);
}
