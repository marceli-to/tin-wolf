import { PLAYER } from '../config';
import { DEG, forwardFromAngles } from '../core/math';
import { spread } from '../core/rng';
import type { WeaponDef } from '../data/schema';
import type { ActorRef, HitZone } from './events';
import { humanoidZones } from './hitbox';
import { rayBox, rayCylinder, rayGrid, type Ray } from './raycast';
import { doorBox, emit, type World } from './world';

export type ShotTarget =
  | { kind: 'world' }
  | { kind: 'prop'; index: number }
  | { kind: 'door'; index: number }
  | { kind: 'actor'; ref: ActorRef; zone: HitZone };

export interface ShotResult {
  t: number;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  target: ShotTarget;
}

/** Actors that can be hit, as hit-cylinder sets. Guards are added in M4. */
export interface ActorShape {
  ref: ActorRef;
  x: number;
  y: number;
  z: number;
  height: number;
}

export function actorShapes(world: World): ActorShape[] {
  const out: ActorShape[] = [];
  for (const p of world.players) {
    if (p.alive) out.push({ ref: { kind: 'player', slot: p.slot }, x: p.x, y: p.y, z: p.z, height: p.height });
  }
  for (const g of world.guards) {
    if (g.state !== 'dead') out.push({ ref: { kind: 'guard', index: g.index }, x: g.x, y: g.y, z: g.z, height: g.height });
  }
  return out;
}

export function sameActor(a: ActorRef, b: ActorRef): boolean {
  return a.kind === b.kind && (a.kind === 'player' ? a.slot === (b as { slot: number }).slot : a.index === (b as { index: number }).index);
}

/** Nearest thing a ray hits: level, props, doors or actors (excluding `ignore`). */
export function traceShot(world: World, ray: Ray, range: number, ignore: ActorRef | null): ShotResult | null {
  let best: ShotResult | null = null;
  const consider = (t: number, nx: number, ny: number, nz: number, target: ShotTarget): void => {
    if (best && t >= best.t) return;
    best = { t, x: ray.ox + ray.dx * t, y: ray.oy + ray.dy * t, z: ray.oz + ray.dz * t, nx, ny, nz, target };
  };
  const g = rayGrid(world.grid, ray, range);
  if (g) consider(g.t, g.nx, g.ny, g.nz, { kind: 'world' });
  const limit = (): number => (best ? (best as ShotResult).t : range);
  world.props.forEach((p, i) => {
    if (!p.alive || !p.solid) return;
    const h = rayBox(ray, p.box, limit());
    if (h) consider(h.t, h.nx, h.ny, h.nz, { kind: 'prop', index: i });
  });
  world.doors.forEach((d, i) => {
    if (d.open >= 0.95) return;
    const h = rayBox(ray, doorBox(world, d), limit());
    if (h) consider(h.t, h.nx, h.ny, h.nz, { kind: 'door', index: i });
  });
  for (const a of actorShapes(world)) {
    if (ignore && sameActor(a.ref, ignore)) continue;
    for (const z of humanoidZones(a.height)) {
      const t = rayCylinder(ray, a.x, a.z, z.r, a.y + z.y0, a.y + z.y1, limit());
      if (t !== null) consider(t, -ray.dx, -ray.dy, -ray.dz, { kind: 'actor', ref: a.ref, zone: z.zone });
    }
  }
  return best;
}

/** Fires one hitscan round with spread and applies the result. */
export function fireHitscan(
  world: World,
  shooter: ActorRef,
  ox: number,
  oy: number,
  oz: number,
  yaw: number,
  pitch: number,
  weapon: WeaponDef,
  weaponId: string,
  extraSpreadDeg = 0,
): ShotResult | null {
  const sp = (weapon.spreadDeg + extraSpreadDeg) * DEG;
  const dir = forwardFromAngles(yaw + spread(world.rng) * sp, pitch + spread(world.rng) * sp);
  const ray: Ray = { ox, oy, oz, dx: dir.x, dy: dir.y, dz: dir.z };
  emit(world, { type: 'shotFired', shooter, x: ox, y: oy, z: oz, weapon: weaponId, noise: weapon.noiseRadius });
  const hit = traceShot(world, ray, weapon.range, shooter);
  if (!hit) return null;
  const t = hit.target;
  if (t.kind === 'actor') {
    const dmg = weapon.damage * weapon.zoneMultiplier[t.zone];
    emit(world, { type: 'impact', x: hit.x, y: hit.y, z: hit.z, nx: hit.nx, ny: hit.ny, nz: hit.nz, surface: 'flesh', onPlayer: t.ref.kind === 'player' });
    applyDamage(world, t.ref, dmg, t.zone, shooter, hit);
  } else if (t.kind === 'prop') {
    emit(world, { type: 'impact', x: hit.x, y: hit.y, z: hit.z, nx: hit.nx, ny: hit.ny, nz: hit.nz, surface: 'prop' });
    damageProp(world, t.index, weapon.damage);
  } else {
    emit(world, { type: 'impact', x: hit.x, y: hit.y, z: hit.z, nx: hit.nx, ny: hit.ny, nz: hit.nz, surface: 'world' });
  }
  return hit;
}

export function damageProp(world: World, index: number, amount: number): void {
  const p = world.props[index];
  if (!p || !p.alive || !p.destructible) return;
  p.hp -= amount;
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    const b = p.box;
    emit(world, { type: 'propDestroyed', id: p.id, x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: (b.minZ + b.maxZ) / 2 });
  }
}

export interface DamagePoint {
  x: number;
  y: number;
  z: number;
}

export function applyDamage(world: World, target: ActorRef, amount: number, zone: HitZone, shooter: ActorRef | null, at: DamagePoint): void {
  if (target.kind === 'player') {
    const p = world.players[target.slot];
    if (!p || !p.alive || p.protect > 0) return;
    // Armour soaks two thirds of incoming damage until it runs out.
    const soak = Math.min(p.armor, amount * (2 / 3));
    p.armor -= soak;
    p.hp -= amount - soak;
    p.hurtTimer = 0.35;
    emit(world, { type: 'hit', target, shooter, zone, damage: amount, x: at.x, y: at.y, z: at.z });
    if (shooter?.kind === 'player') {
      const s = world.players[shooter.slot];
      if (s) s.shotsHit++;
    }
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      p.deadTimer = PLAYER.respawnDelay;
      p.deaths++;
      if (shooter?.kind === 'player' && shooter.slot !== p.slot) {
        const s = world.players[shooter.slot];
        if (s) s.kills++;
      }
      emit(world, { type: 'died', target, killer: shooter, x: p.x, z: p.z });
    }
    return;
  }
  const g = world.guards[target.index];
  if (!g || g.state === 'dead') return;
  g.hp -= amount;
  // The AI reads these on its next think: flinch, and turn toward whoever shot.
  g.flinch = zone === 'head' ? 0.5 : 0.3;
  g.lastHurtBy = shooter;
  emit(world, { type: 'hit', target, shooter, zone, damage: amount, x: at.x, y: at.y, z: at.z });
  if (shooter?.kind === 'player') {
    const s = world.players[shooter.slot];
    if (s) s.shotsHit++;
  }
  if (g.hp <= 0) {
    g.hp = 0;
    g.state = 'dead';
    g.deadTime = 0;
    if (shooter?.kind === 'player') {
      const s = world.players[shooter.slot];
      if (s) s.kills++;
    }
    emit(world, { type: 'died', target, killer: shooter, x: g.x, z: g.z });
    dropLoot(world, g.archetype, g.id, g.x, g.y, g.z);
  }
}

/** A fallen guard leaves its archetype's drop (ammo, or its gun) where it fell. */
function dropLoot(world: World, archetype: string, id: string, x: number, y: number, z: number): void {
  const def = world.data.enemies[archetype];
  const item = def?.drop ? world.data.items[def.drop] : null;
  if (!def?.drop || !item) return;
  world.pickups.push({ id: `drop_${id}`, item: def.drop, amount: def.dropAmount ?? item.amount, x, y, z, respawn: null, timer: 0, active: true });
}
