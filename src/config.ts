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
  sprintSpeed: 7.5,
  /** Jump apex in metres; with the 0.4 m step-up a jump reaches ledges up to 1.25 m (crates, barrels, desks). */
  jumpHeight: 0.85,
  accel: 40,
  maxHp: 100,
  respawnDelay: 2.5,
  spawnProtection: 1.5,
};

/** Power-ups from surprise boxes (src/sim/powerups.ts). Durations live with the items in src/data/items.json. */
export const POWER = {
  /** Zoom Boots: walk and sprint speed multiplier. */
  speedScale: 1.6,
  /** Double Blast: damage multiplier on everything the player hurts. */
  damageScale: 2,
  /** Moon Jump: jump apex in metres (normal 0.85). */
  jumpHeight: 2.2,
  /** Shrink Ray: size, speed and damage of a shrunk player or guard. */
  tinyScale: 0.55,
  tinySpeed: 0.75,
  tinyDamage: 0.5,
  /** Shrink Ray reaches guards this close in missions (other players are always hit). */
  shrinkRadius: 25,
};

export const WORLD = {
  stepHeight: 0.4,
  gravity: 22,
  /** Movement is sub-stepped so no single step exceeds this fraction of the actor radius. */
  maxStepFraction: 0.5,
  maxPitch: 85 * (Math.PI / 180),
};

/** Gamepad aim assist (see sim/aimAssist.ts). */
export const AIM_ASSIST = {
  /** Assist cone around the crosshair, plus the target's own angular width. */
  coneDeg: 6,
  range: 35,
  /** Look speed multiplier with the crosshair right on a target. */
  slowdown: 0.45,
  /** Fastest drift toward the target, radians per second. */
  pullRate: 0.9,
  /** Aim point as a fraction of the target's height. */
  aimHeight: 0.6,
};

export const AI = {
  thinkRate: 10,
};

export const RENDER = {
  internalHeight: 240,
  fov: 70,
};
