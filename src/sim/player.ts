import { PLAYER, POWER, WORLD } from '../config';
import { clamp } from '../core/math';
import type { PlayerIntent } from '../core/intent';
import { applyAimAssist } from './aimAssist';
import { hasHeadroom, moveBody, updateVertical } from './collision';
import { interactTarget } from './doors';
import { sizeScale } from './powerups';
import { emit, type Player, type World } from './world';

const CROUCH_RATE = 7;
const STEP_LENGTH = 2.2;
/** Scope in / out speed (full zoom in 1/ZOOM_RATE seconds). */
const ZOOM_RATE = 6;

export function playerEyeHeight(p: Player): number {
  return (PLAYER.eyeHeight + (PLAYER.crouchEyeHeight - PLAYER.eyeHeight) * p.crouch) * sizeScale(p.power.tiny);
}

/** Current scope magnification (1 when not zoomed). */
export function zoomFactor(world: World, p: Player): number {
  const mag = world.data.weapons[p.weapon.id]?.zoom ?? 1;
  return 1 + (mag - 1) * p.zoom;
}

export function updatePlayerMovement(world: World, p: Player, intent: PlayerIntent, dt: number): void {
  // Scope in while aiming a scoped weapon, not while switching, reloading or sprinting.
  const def = world.data.weapons[p.weapon.id];
  const scoped = intent.aim && (def?.zoom ?? 1) > 1 && p.switchTimer <= 0 && p.weapon.reloadTimer <= 0;
  p.zoom = scoped ? Math.min(1, p.zoom + ZOOM_RATE * dt) : Math.max(0, p.zoom - ZOOM_RATE * dt);
  applyAimAssist(world, p, intent, dt);
  // Zoomed in, the same stick or mouse movement turns less, so the view moves at the same on-screen speed.
  const lookScale = 1 / zoomFactor(world, p);
  p.yaw += intent.lookYaw * lookScale;
  p.pitch = clamp(p.pitch + intent.lookPitch * lookScale, -WORLD.maxPitch, WORLD.maxPitch);

  // Standing up needs headroom; toggle-crouch for gamepads is handled by the input device.
  if (intent.crouch) p.crouch = Math.min(1, p.crouch + CROUCH_RATE * dt);
  else if (p.crouch > 0 && hasHeadroom(world.terrain, p, PLAYER.height)) p.crouch = Math.max(0, p.crouch - CROUCH_RATE * dt);
  p.height = (PLAYER.height + (PLAYER.crouchHeight - PLAYER.height) * p.crouch) * sizeScale(p.power.tiny);

  let mx = intent.moveX;
  let mz = intent.moveZ;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) {
    mx /= ml;
    mz /= ml;
  }
  // Sprint only runs forward, standing up; it keeps going in the air but cannot start there.
  p.sprinting = intent.sprint && !scoped && intent.moveZ > 0.5 && p.crouch < 0.05 && (p.grounded || p.sprinting);
  const base = p.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed + (PLAYER.crouchSpeed - PLAYER.walkSpeed) * p.crouch;
  const speed = base * (p.power.speed > 0 ? POWER.speedScale : 1) * (p.power.tiny > 0 ? POWER.tinySpeed : 1);
  const sin = Math.sin(p.yaw);
  const cos = Math.cos(p.yaw);
  // forward = (sin, -cos), right = (cos, sin)
  const tvx = (sin * mz + cos * mx) * speed;
  const tvz = (-cos * mz + sin * mx) * speed;
  const maxDv = PLAYER.accel * dt;
  const dvx = tvx - p.vx;
  const dvz = tvz - p.vz;
  const dvl = Math.hypot(dvx, dvz);
  if (dvl <= maxDv) {
    p.vx = tvx;
    p.vz = tvz;
  } else {
    p.vx += (dvx / dvl) * maxDv;
    p.vz += (dvz / dvl) * maxDv;
  }

  // Jump on the press, from the ground, standing. A gamepad's A also uses doors: using wins.
  if (intent.jump && !p.jumpPrev && p.grounded && p.crouch < 0.5 && !(intent.interact && interactTarget(world, p))) {
    // Half a tick of gravity on top, so the stepped arc peaks at the configured height.
    const apex = p.power.jump > 0 ? POWER.jumpHeight : PLAYER.jumpHeight;
    p.vy = Math.sqrt(2 * WORLD.gravity * apex) + 0.5 * WORLD.gravity * dt;
    p.grounded = false;
  }
  p.jumpPrev = intent.jump;

  const ox = p.x;
  const oz = p.z;
  const oy = p.y;
  const fallSpeed = -p.vy;
  const wasGrounded = p.grounded;
  moveBody(world.terrain, p, p.vx * dt, p.vz * dt);
  updateVertical(world.terrain, p, dt);
  // Head bump: a jump stops under a low ceiling (ducts, doorways).
  if (p.vy > 0 && !hasHeadroom(world.terrain, p, p.height)) {
    p.y = oy;
    p.vy = 0;
  }
  // Landing makes a footstep; a hard landing is as loud as sprinting.
  if (!wasGrounded && p.grounded && fallSpeed > 3) emit(world, { type: 'footstep', x: p.x, y: p.y, z: p.z, slot: p.slot, loud: fallSpeed > 6 });

  if (p.grounded) {
    p.stepDist += Math.hypot(p.x - ox, p.z - oz);
    if (p.stepDist > STEP_LENGTH) {
      p.stepDist = 0;
      if (p.crouch < 0.5) emit(world, { type: 'footstep', x: p.x, y: p.y, z: p.z, slot: p.slot, loud: p.sprinting });
    }
  }
}
