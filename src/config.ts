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

/** Computer players (src/sim/bot.ts), per difficulty. Angles in degrees, times in seconds. */
export interface BotSkill {
  /** Delay before the first shot at someone newly spotted. */
  reaction: number;
  /** Fastest turn, degrees per second. */
  turnRate: number;
  /** Typical aim error; it wanders, so some shots land and some miss. */
  aimError: number;
  /** Field of view for spotting someone (anyone very close is noticed anyway). */
  fov: number;
  /** Seconds between rough guesses of where an unseen opponent is, so bots do not wander forever. */
  huntEvery: number;
  /** Uses the rifle's scope at range. */
  scope: boolean;
  /** Side-steps while fighting. */
  strafe: boolean;
  /** Pauses between shots of an automatic weapon (0 = hold the trigger). */
  burstPause: number;
}

export const BOT_SKILL: Record<string, BotSkill> = {
  easy: { reaction: 0.9, turnRate: 160, aimError: 7, fov: 100, huntEvery: 22, scope: false, strafe: false, burstPause: 0.7 },
  normal: { reaction: 0.45, turnRate: 300, aimError: 3.2, fov: 130, huntEvery: 12, scope: true, strafe: true, burstPause: 0.35 },
  hard: { reaction: 0.22, turnRate: 480, aimError: 1.4, fov: 160, huntEvery: 7, scope: true, strafe: true, burstPause: 0 },
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
