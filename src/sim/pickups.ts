import { PLAYER } from '../config';
import { emit, type Pickup, type Player, type World } from './world';

const REACH = 0.9;

/** Applies a pickup to a player. Returns false if it would do nothing (full health, full ammo). */
function apply(world: World, p: Player, pk: Pickup): boolean {
  const item = world.data.items[pk.item];
  if (!item) return false;
  switch (item.kind) {
    case 'health':
      if (p.hp >= PLAYER.maxHp) return false;
      p.hp = Math.min(PLAYER.maxHp, p.hp + pk.amount);
      return true;
    case 'armor':
      if (p.armor >= 100) return false;
      p.armor = Math.min(100, p.armor + pk.amount);
      return true;
    case 'ammo': {
      const def = world.data.weapons[p.weapon.id];
      if (!def || p.weapon.reserve >= def.maxReserve) return false;
      p.weapon.reserve = Math.min(def.maxReserve, p.weapon.reserve + pk.amount);
      return true;
    }
    case 'key':
      if (!p.inventory.includes(pk.item)) p.inventory.push(pk.item);
      return true;
  }
}

export function updatePickups(world: World, dt: number): void {
  for (const pk of world.pickups) {
    if (!pk.active) {
      if (pk.respawn === null) continue;
      pk.timer -= dt;
      if (pk.timer <= 0) pk.active = true;
      continue;
    }
    for (const p of world.players) {
      if (!p.alive) continue;
      if (Math.hypot(p.x - pk.x, p.z - pk.z) > REACH || Math.abs(p.y - pk.y) > 1.2) continue;
      if (!apply(world, p, pk)) continue;
      pk.active = false;
      pk.timer = pk.respawn ?? 0;
      emit(world, { type: 'pickup', slot: p.slot, item: pk.item, x: pk.x, y: pk.y, z: pk.z });
      break;
    }
  }
}
