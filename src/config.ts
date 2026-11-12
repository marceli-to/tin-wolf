/** Engine constants. Content values (weapons, enemies, levels) live in src/data. */
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const PLAYER = {
  radius: 0.32,
  height: 1.75,
  crouchHeight: 1.15,
  eyeHeight: 1.6,
  crouchEyeHeight: 1.0,
  walkSpeed: 5.0,
  crouchSpeed: 2.2,
  accel: 40,
  maxHp: 100,
  respawnDelay: 2.5,
  spawnProtection: 1.5,
};

export const WORLD = {
  stepHeight: 0.4,
  gravity: 22,
  /** Movement is sub-stepped so no single step exceeds this fraction of the actor radius. */
  maxStepFraction: 0.5,
  maxPitch: 85 * (Math.PI / 180),
};

export const AI = {
  thinkRate: 10,
};

export const RENDER = {
  internalHeight: 240,
  fov: 70,
};
