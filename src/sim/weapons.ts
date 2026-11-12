import type { PlayerIntent } from '../core/intent';
import type { GameData } from '../data';
import { fireHitscan } from './combat';
import { playerEyeHeight } from './player';
import { throwProjectile } from './projectiles';
import { emit, type Player, type World } from './world';

/** Seconds to lower one weapon and raise the next. */
export const SWITCH_TIME = 0.4;

/** A thrown weapon with nothing left to throw cannot be drawn. */
function usable(data: GameData, p: Player, id: string): boolean {
  const def = data.weapons[id];
  return !!def && (def.type !== 'thrown' || (p.ammo[def.ammo] ?? 0) > 0);
}

export function switchWeapon(world: World, p: Player, index: number): boolean {
  const next = p.weapons[index];
  if (!next || next === p.weapon || !usable(world.data, p, next.id)) return false;
  p.weapon.reloadTimer = 0;
  p.weapon = next;
  p.switchTimer = SWITCH_TIME;
  emit(world, { type: 'weaponSwitched', slot: p.slot, weapon: next.id });
  return true;
}

/** Steps through owned weapons in `dir`, skipping ones that cannot be drawn. */
export function cycleWeapon(world: World, p: Player, dir: 1 | -1): boolean {
  const n = p.weapons.length;
  const at = p.weapons.indexOf(p.weapon);
  for (let k = 1; k < n; k++) {
    const i = (((at + dir * k) % n) + n) % n;
    if (switchWeapon(world, p, i)) return true;
  }
  return false;
}

/** Fire rate, magazine, ammo pool, reload and weapon switching for one player. */
export function updatePlayerWeapon(world: World, p: Player, intent: PlayerIntent, dt: number): void {
  const switchPressed = (intent.weaponNext || intent.weaponPrev || intent.weaponSlot > 0) && !p.switchPrev;
  p.switchPrev = intent.weaponNext || intent.weaponPrev || intent.weaponSlot > 0;
  if (switchPressed) {
    if (intent.weaponSlot > 0) switchWeapon(world, p, intent.weaponSlot - 1);
    else cycleWeapon(world, p, intent.weaponNext ? 1 : -1);
  }

  const w = p.weapon;
  const def = world.data.weapons[w.id];
  if (!def) return;
  w.cooldown = Math.max(0, w.cooldown - dt);
  p.sinceShot += dt;
  if (p.switchTimer > 0) {
    p.switchTimer = Math.max(0, p.switchTimer - dt);
    p.firePrev = intent.fire;
    p.reloadPrev = intent.reload;
    return;
  }

  if (w.reloadTimer > 0) {
    w.reloadTimer -= dt;
    if (w.reloadTimer <= 0) {
      w.reloadTimer = 0;
      const pool = p.ammo[def.ammo] ?? 0;
      const take = Math.min(def.magSize - w.mag, pool);
      w.mag += take;
      p.ammo[def.ammo] = pool - take;
    }
  }

  const reloadPressed = intent.reload && !p.reloadPrev;
  p.reloadPrev = intent.reload;
  if (reloadPressed) startReload(world, p);

  const firePressed = intent.fire && !p.firePrev;
  p.firePrev = intent.fire;
  const wantsFire = def.auto ? intent.fire : firePressed;
  if (!wantsFire || w.cooldown > 0 || w.reloadTimer > 0) return;

  const eye = p.y + playerEyeHeight(p);
  if (def.type === 'thrown') {
    const left = p.ammo[def.ammo] ?? 0;
    if (left <= 0) return;
    p.ammo[def.ammo] = left - 1;
    w.cooldown = def.fireInterval;
    p.sinceShot = 0;
    p.protect = 0;
    throwProjectile(world, { kind: 'player', slot: p.slot }, p.x, eye, p.z, p.yaw, p.pitch, def, w.id);
    // Out of grenades: put the hand away and draw the next weapon.
    if (left - 1 <= 0) cycleWeapon(world, p, -1);
    return;
  }

  if (w.mag <= 0) {
    if (firePressed) emit(world, { type: 'dryFire', slot: p.slot });
    // An empty gun with an empty pool switches to something that can still shoot.
    if (!startReload(world, p) && firePressed) cycleWeapon(world, p, 1);
    return;
  }
  w.mag--;
  w.cooldown = def.fireInterval;
  p.sinceShot = 0;
  p.shotsFired++;
  p.protect = 0;
  // Crouching steadies aim; moving fast spoils it. A scope takes the weapon's own spread away.
  const moving = (Math.hypot(p.vx, p.vz) / 5) * (1 - 0.7 * p.zoom);
  const extra = Math.max(-def.spreadDeg, moving * 1.5 - p.crouch * def.spreadDeg * 0.5 - def.spreadDeg * p.zoom);
  fireHitscan(world, { kind: 'player', slot: p.slot }, p.x, eye, p.z, p.yaw, p.pitch, def, w.id, extra);
}

export function startReload(world: World, p: Player): boolean {
  const w = p.weapon;
  const def = world.data.weapons[w.id];
  if (!def || def.type === 'thrown' || w.reloadTimer > 0 || w.mag >= def.magSize || (p.ammo[def.ammo] ?? 0) <= 0) return false;
  w.reloadTimer = def.reloadTime;
  emit(world, { type: 'reloadStart', slot: p.slot });
  return true;
}

/** Adds a weapon (or just its ammo if already owned). Returns false if nothing changed. */
export function giveWeapon(world: World, p: Player, id: string, ammo: number): boolean {
  const def = world.data.weapons[id];
  if (!def) return false;
  const pool = p.ammo[def.ammo] ?? 0;
  const owned = p.weapons.find((w) => w.id === id);
  if (owned && pool >= def.maxReserve) return false;
  p.ammo[def.ammo] = Math.min(def.maxReserve, pool + ammo);
  if (owned) return true;
  const w = { id, mag: 0, cooldown: 0, reloadTimer: 0 };
  // A new gun arrives loaded from the ammo that came with it.
  if (def.type !== 'thrown') {
    const take = Math.min(def.magSize, p.ammo[def.ammo] ?? 0);
    w.mag = take;
    p.ammo[def.ammo] = (p.ammo[def.ammo] ?? 0) - take;
  }
  p.weapons.push(w);
  // Like the classics: a newly found gun is drawn at once (grenades are not).
  if (def.type !== 'thrown') switchWeapon(world, p, p.weapons.length - 1);
  return true;
}
