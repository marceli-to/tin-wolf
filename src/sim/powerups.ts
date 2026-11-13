import { PLAYER, POWER } from '../config';
import { nextFloat } from '../core/rng';
import type { ItemDef } from '../data/schema';
import { hasHeadroom } from './collision';
import { emit, type Player, type PowerName, type Prop, type World } from './world';

/** Size of a body: a Shrink Ray makes it small for a while. */
export function sizeScale(tiny: number): number {
  return tiny > 0 ? POWER.tinyScale : 1;
}

/** Applies a power-up item to the player who picked it up. False if it would do nothing (a refill when full). */
export function applyPowerup(world: World, p: Player, itemId: string, item: ItemDef): boolean {
  const d = item.duration;
  switch (item.effect) {
    case 'speed':
    case 'shield':
    case 'damage':
    case 'jump':
      p.power[item.effect] = Math.max(p.power[item.effect], d);
      // A shield also cures being tiny.
      if (item.effect === 'shield' && p.power.tiny > 0) endTiny(world, p);
      break;
    case 'refill':
      if (!refill(world, p)) return false;
      break;
    case 'shrink':
      shrinkOthers(world, p, d);
      break;
    default:
      return false;
  }
  emit(world, { type: 'powerup', slot: p.slot, item: itemId, x: p.x, z: p.z });
  return true;
}

/** Full health, and every owned weapon's magazine and pool topped up. False if all of it was full already. */
function refill(world: World, p: Player): boolean {
  let changed = false;
  if (p.hp < PLAYER.maxHp) {
    p.hp = PLAYER.maxHp;
    changed = true;
  }
  for (const w of p.weapons) {
    const def = world.data.weapons[w.id];
    if (!def) continue;
    if (def.type !== 'thrown' && w.mag < def.magSize) {
      w.mag = def.magSize;
      w.reloadTimer = 0;
      changed = true;
    }
    if ((p.ammo[def.ammo] ?? 0) < def.maxReserve) {
      p.ammo[def.ammo] = def.maxReserve;
      changed = true;
    }
  }
  return changed;
}

/** Every other player, and guards nearby, go tiny. A Bubble Shield protects. */
function shrinkOthers(world: World, by: Player, duration: number): void {
  for (const o of world.players) {
    if (o === by || !o.alive || o.power.shield > 0) continue;
    o.power.tiny = Math.max(o.power.tiny, duration);
    emit(world, { type: 'shrunk', target: { kind: 'player', slot: o.slot }, by: by.slot, x: o.x, y: o.y, z: o.z });
  }
  for (const g of world.guards) {
    if (g.state === 'dead' || Math.hypot(g.x - by.x, g.z - by.z) > POWER.shrinkRadius) continue;
    g.tiny = Math.max(g.tiny, duration);
    emit(world, { type: 'shrunk', target: { kind: 'guard', index: g.index }, by: by.slot, x: g.x, y: g.y, z: g.z });
  }
}

function endTiny(world: World, p: Player): void {
  p.power.tiny = 0;
  // Growing back under a low ceiling (a duct): come back crouched; standing up waits for headroom.
  if (!hasHeadroom(world.terrain, p, PLAYER.height)) p.crouch = 1;
  emit(world, { type: 'powerEnded', slot: p.slot, power: 'tiny' });
}

const TIMED: PowerName[] = ['speed', 'shield', 'damage', 'jump'];

/** Counts power-up timers down (players and shrunk guards). */
export function updatePowers(world: World, dt: number): void {
  for (const p of world.players) {
    if (!p.alive) continue;
    for (const k of TIMED) {
      if (p.power[k] <= 0) continue;
      p.power[k] = Math.max(0, p.power[k] - dt);
      if (p.power[k] === 0) emit(world, { type: 'powerEnded', slot: p.slot, power: k });
    }
    if (p.power.tiny > 0) {
      p.power.tiny = Math.max(0, p.power.tiny - dt);
      if (p.power.tiny === 0) endTiny(world, p);
    }
  }
  for (const g of world.guards) if (g.tiny > 0) g.tiny = Math.max(0, g.tiny - dt);
}

/** A broken surprise box leaves a power-up where it stood. */
export function dropFromBox(world: World, prop: Prop): void {
  const loot = world.data.props[prop.kind]?.loot;
  if (!loot?.length && !prop.drop) return;
  const id = prop.drop ?? loot![Math.min(loot!.length - 1, Math.floor(nextFloat(world.rng) * loot!.length))]!;
  const item = world.data.items[id];
  if (!item) return;
  const b = prop.box;
  prop.dropped = world.pickups.length;
  world.pickups.push({
    id: `${prop.id}_drop_${world.tick}`,
    item: id,
    amount: item.amount,
    x: (b.minX + b.maxX) / 2,
    y: b.minY,
    z: (b.minZ + b.maxZ) / 2,
    respawn: null,
    timer: 0,
    active: true,
  });
}

/** Surprise boxes come back a while after their drop was taken, once nobody stands in the way. */
export function updateBoxes(world: World, dt: number): void {
  for (const pr of world.props) {
    if (pr.alive || pr.respawn === null) continue;
    if (pr.dropped !== null) {
      if (world.pickups[pr.dropped]?.active) continue;
      pr.dropped = null;
      pr.timer = pr.respawn;
    }
    pr.timer -= dt;
    if (pr.timer > 0 || blocked(world, pr)) continue;
    pr.alive = true;
    pr.hp = pr.maxHp;
    const b = pr.box;
    emit(world, { type: 'propRespawned', id: pr.id, x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: (b.minZ + b.maxZ) / 2 });
  }
}

function blocked(world: World, pr: Prop): boolean {
  const b = pr.box;
  const bodies = [...world.players.filter((p) => p.alive), ...world.guards.filter((g) => g.state !== 'dead')];
  return bodies.some(
    (a) => a.x + a.radius > b.minX && a.x - a.radius < b.maxX && a.z + a.radius > b.minZ && a.z - a.radius < b.maxZ && a.y < b.maxY && a.y + a.height > b.minY,
  );
}
