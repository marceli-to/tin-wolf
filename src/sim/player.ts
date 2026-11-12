import { PLAYER, WORLD } from '../config';
import { clamp } from '../core/math';
import type { PlayerIntent } from '../core/intent';
import { applyAimAssist } from './aimAssist';
import { hasHeadroom, moveBody, updateVertical } from './collision';
import { emit, type Player, type World } from './world';

const CROUCH_RATE = 7;
const STEP_LENGTH = 2.2;

export function playerEyeHeight(p: Player): number {
  return PLAYER.eyeHeight + (PLAYER.crouchEyeHeight - PLAYER.eyeHeight) * p.crouch;
}

export function updatePlayerMovement(world: World, p: Player, intent: PlayerIntent, dt: number): void {
  applyAimAssist(world, p, intent, dt);
  p.yaw += intent.lookYaw;
  p.pitch = clamp(p.pitch + intent.lookPitch, -WORLD.maxPitch, WORLD.maxPitch);

  // Standing up needs headroom; toggle-crouch for gamepads is handled by the input device.
  if (intent.crouch) p.crouch = Math.min(1, p.crouch + CROUCH_RATE * dt);
  else if (p.crouch > 0 && hasHeadroom(world.terrain, p, PLAYER.height)) p.crouch = Math.max(0, p.crouch - CROUCH_RATE * dt);
  p.height = PLAYER.height + (PLAYER.crouchHeight - PLAYER.height) * p.crouch;

  let mx = intent.moveX;
  let mz = intent.moveZ;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) {
    mx /= ml;
    mz /= ml;
  }
  const speed = PLAYER.walkSpeed + (PLAYER.crouchSpeed - PLAYER.walkSpeed) * p.crouch;
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

  const ox = p.x;
  const oz = p.z;
  moveBody(world.terrain, p, p.vx * dt, p.vz * dt);
  updateVertical(world.terrain, p, dt);

  if (p.grounded) {
    p.stepDist += Math.hypot(p.x - ox, p.z - oz);
    if (p.stepDist > STEP_LENGTH) {
      p.stepDist = 0;
      if (p.crouch < 0.5) emit(world, { type: 'footstep', x: p.x, y: p.y, z: p.z, slot: p.slot });
    }
  }
}
