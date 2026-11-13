/** Base colours per material name used in level legends and prop kinds. Textures arrive in M6. */
export const MATERIAL_COLORS: Record<string, string> = {
  concrete: '#8c8a82',
  tile: '#a3aaa8',
  metal: '#6c767c',
  panel: '#7a8590',
  ceiling: '#6a6c6e',
  wood: '#8a6a44',
  snow: '#dde4e8',
  ice: '#b8d0dc',
  rock: '#6e6a66',
  brick: '#8a5a48',
  grate: '#4e5458',
  crate: '#8f6d3e',
  barrel: '#7a3a2c',
  console: '#3d4c5c',
  door: '#7d6a4c',
  door_red: '#8a3a32',
  door_blue: '#3a4e8a',
  hazard: '#c9a23a',
  carpet: '#5a3a3a',
  roof: '#5d7a96',
  surprise: '#8a5cf0',
  space_wall: '#e9eef5',
  space_window: '#0d1530',
  space_floor: '#4a5670',
  space_strip: '#3c465c',
  space_ceil: '#cfd8e3',
  space_plate: '#9fb3c8',
  space_hazard: '#5fd0f0',
  toy_bricks: '#e9453a',
  castle_stone: '#b3ada2',
  grass: '#7cc76a',
  castle_floor: '#cbc3b2',
  castle_roof: '#c9483c',
  toy_wall: '#bfe3ff',
  toy_floor: '#bfe9d9',
  toy_top: '#ffc93c',
  toy_ceil: '#cfe8ff',
  toy_plank: '#3b82d6',
  toy_candy: '#e9453a',
  toy_red: '#e9453a',
  toy_yellow: '#ffc93c',
  toy_blue: '#3b82d6',
  block_a: '#e9453a',
  block_b: '#3b82d6',
  block_c: '#3fb56b',
  block_1: '#ffc93c',
};

export const PLAYER_COLORS = ['#2f5f8f', '#8f3a2f', '#3f7f3f', '#8f7f2f'];

export function materialColor(name: string): string {
  return MATERIAL_COLORS[name] ?? '#ff00ff';
}

/** Fake directional lighting so faces read without real lights. */
export const SHADE = {
  top: 1.0,
  bottom: 0.55,
  ns: 0.82,
  ew: 0.68,
};
