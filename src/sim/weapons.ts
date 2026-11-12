import type { PlayerIntent } from '../core/intent';
import { fireHitscan } from './combat';
import { playerEyeHeight } from './player';
import { emit, type Player, type World } from './world';

/** Fire rate, magazine, reserve and reload for one player. */
export function updatePlayerWeapon(world: World, p: Player, intent: PlayerIntent, dt: number): void {
  const w = p.weapon;
  const def = world.data.weapons[w.id];
  if (!def) return;
  w.cooldown = Math.max(0, w.cooldown - dt);
  p.sinceShot += dt;

  if (w.reloadTimer > 0) {
    w.reloadTimer -= dt;
    if (w.reloadTimer <= 0) {
      w.reloadTimer = 0;
      const take = Math.min(def.magSize - w.mag, w.reserve);
      w.mag += take;
      w.reserve -= take;
    }
  }

  const reloadPressed = intent.reload && !p.reloadPrev;
  p.reloadPrev = intent.reload;
  if (reloadPressed) startReload(world, p);

  const firePressed = intent.fire && !p.firePrev;
  p.firePrev = intent.fire;
  const wantsFire = def.auto ? intent.fire : firePressed;
  if (!wantsFire || w.cooldown > 0 || w.reloadTimer > 0) return;
  if (w.mag <= 0) {
    if (firePressed) emit(world, { type: 'dryFire', slot: p.slot });
    startReload(world, p);
    return;
  }
  w.mag--;
  w.cooldown = def.fireInterval;
  p.sinceShot = 0;
  p.shotsFired++;
  p.protect = 0;
  // Crouching steadies aim; moving fast spoils it.
  const moving = Math.hypot(p.vx, p.vz) / 5;
  const extra = moving * 1.5 - p.crouch * def.spreadDeg * 0.5;
  fireHitscan(world, { kind: 'player', slot: p.slot }, p.x, p.y + playerEyeHeight(p), p.z, p.yaw, p.pitch, def, w.id, extra);
}

export function startReload(world: World, p: Player): boolean {
  const w = p.weapon;
  const def = world.data.weapons[w.id];
  if (!def || w.reloadTimer > 0 || w.mag >= def.magSize || w.reserve <= 0) return false;
  w.reloadTimer = def.reloadTime;
  emit(world, { type: 'reloadStart', slot: p.slot });
  return true;
}
