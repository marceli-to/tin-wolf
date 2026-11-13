import { BOT_SKILL, DT, PLAYER, type BotSkill } from '../config';
import { emptyIntent, type PlayerIntent } from '../core/intent';
import { angleDiff, clamp, DEG, yawTo } from '../core/math';
import { nextFloat } from '../core/rng';
import { botNav, findBotPath, nodeAt, walkableLine, type NavPoint } from './botnav';
import { traceShot } from './combat';
import { clearLine } from './los';
import { playerEyeHeight } from './player';
import type { Player, World } from './world';

/**
 * Computer player. Each tick it looks at the world the way a player could (who is in sight, what
 * lies around) and returns the buttons it presses; the sim then moves, shoots and scores it exactly
 * like a person. Randomness comes from the world's RNG, so a match replays the same way.
 */
export interface BotBrain {
  /** Slot of the opponent in sight, or null. */
  target: number | null;
  /** Where an opponent was last seen or heard, and how long ago. */
  lastKnown: NavPoint | null;
  lastKnownAge: number;
  /** Counts down to the first shot at a newly spotted opponent. */
  reaction: number;
  /** Wandering aim error (radians) and when it changes next. */
  errYaw: number;
  errPitch: number;
  errTimer: number;
  /** Where it is going and the path there. */
  goal: Goal | null;
  path: NavPoint[];
  pathIndex: number;
  replan: number;
  rethink: number;
  strafe: 1 | -1;
  strafeTimer: number;
  huntTimer: number;
  /** Pause before the next burst (automatic weapons, lower skills). */
  burstTimer: number;
  stuck: number;
  lastPos: { x: number; z: number };
  firePrev: boolean;
  switchPrev: boolean;
  jumpPrev: boolean;
  /** Seconds spent on the current goal, and goals given up on (key → world time to retry). */
  goalTime: number;
  ignore: Map<string, number>;
}

interface Goal {
  kind: 'pickup' | 'box' | 'hunt' | 'roam' | 'chase';
  x: number;
  y: number;
  z: number;
  /** Pickup or prop index, for checking it is still there. */
  index: number;
}

export function createBrain(): BotBrain {
  return {
    target: null,
    lastKnown: null,
    lastKnownAge: 99,
    reaction: 0,
    errYaw: 0,
    errPitch: 0,
    errTimer: 0,
    goal: null,
    path: [],
    pathIndex: 0,
    replan: 0,
    rethink: 0,
    strafe: 1,
    strafeTimer: 0,
    huntTimer: 3,
    burstTimer: 0,
    stuck: 0,
    lastPos: { x: 0, z: 0 },
    firePrev: false,
    switchPrev: false,
    jumpPrev: false,
    goalTime: 0,
    ignore: new Map(),
  };
}

const SIGHT_RANGE = 70;
/** Anyone this close is noticed whichever way the bot faces. */
const NEAR_SENSE = 4;
const HEAR_RANGE = 30;
const ARRIVE = 0.45;

/** Height on a body the bot aims at (a little above the middle: the chibi torso and head). */
const AIM_AT = 0.6;

export function botIntent(world: World, p: Player): PlayerIntent {
  const b = world.brains[p.slot];
  const intent = emptyIntent();
  if (!b) return intent;
  if (!p.alive) {
    // Forget the fight while waiting to respawn.
    b.target = null;
    b.goal = null;
    b.path = [];
    b.firePrev = b.switchPrev = b.jumpPrev = false;
    return intent;
  }
  const skill = BOT_SKILL[world.botSkill] ?? BOT_SKILL.normal!;
  perceive(world, p, b, skill);
  chooseWeapon(world, p, b, intent);

  const target = b.target !== null ? world.players[b.target]! : null;
  let aim: NavPoint | null = null;
  let shootable = false;
  if (target) {
    aim = { x: target.x, y: target.y + target.height * AIM_AT, z: target.z };
    shootable = true;
  } else if (b.goal?.kind === 'box') {
    // Break a surprise box from a few steps away.
    const box = world.props[b.goal.index];
    const eye = p.y + playerEyeHeight(p);
    if (box?.alive) {
      const bx = (box.box.minX + box.box.maxX) / 2;
      const by = (box.box.minY + box.box.maxY) / 2;
      const bz = (box.box.minZ + box.box.maxZ) / 2;
      if (Math.hypot(bx - p.x, bz - p.z) < 9 && shotHitsProp(world, p, eye, bx, by, bz, b.goal.index)) {
        aim = { x: bx, y: by, z: bz };
        shootable = true;
      }
    }
  }

  move(world, p, b, skill, intent, target, shootable && !target);
  look(world, p, b, skill, intent, aim);
  if (shootable && aim) shoot(world, p, b, skill, intent, aim, !!target);
  else b.firePrev = false;

  // Reload when empty, or when quiet and half empty.
  const def = world.data.weapons[p.weapon.id];
  if (def && def.type !== 'thrown' && (p.ammo[def.ammo] ?? 0) > 0 && (p.weapon.mag === 0 || (!target && p.weapon.mag < def.magSize / 2))) intent.reload = true;
  return intent;
}

/** Would a shot from the eye toward (x, y, z) hit prop `index` first? */
function shotHitsProp(world: World, p: Player, eye: number, x: number, y: number, z: number, index: number): boolean {
  const dx = x - p.x;
  const dy = y - eye;
  const dz = z - p.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-3) return false;
  const hit = traceShot(world, { ox: p.x, oy: eye, oz: p.z, dx: dx / d, dy: dy / d, dz: dz / d }, d + 1, { kind: 'player', slot: p.slot });
  return hit?.target.kind === 'prop' && hit.target.index === index;
}

function eyeOf(p: Player): number {
  return p.y + playerEyeHeight(p);
}

function canSee(world: World, p: Player, o: Player): boolean {
  const eye = eyeOf(p);
  return clearLine(world, p.x, eye, p.z, o.x, o.y + o.height * 0.85, o.z) || clearLine(world, p.x, eye, p.z, o.x, o.y + o.height * 0.4, o.z);
}

function perceive(world: World, p: Player, b: BotBrain, skill: BotSkill): void {
  b.lastKnownAge += DT;
  let best: Player | null = null;
  let bestD = Infinity;
  for (const o of world.players) {
    if (o === p || !o.alive) continue;
    const d = Math.hypot(o.x - p.x, o.z - p.z);
    if (d > SIGHT_RANGE || d >= bestD) continue;
    // Keep tracking the current target all round; spot new ones within the field of view.
    const inView = o.slot === b.target || d < NEAR_SENSE || Math.abs(angleDiff(p.yaw, yawTo(p.x, p.z, o.x, o.z))) < (skill.fov / 2) * DEG;
    if (!inView || !canSee(world, p, o)) continue;
    best = o;
    bestD = d;
  }
  if (best) {
    if (b.target !== best.slot) b.reaction = skill.reaction * (0.8 + 0.4 * nextFloat(world.rng));
    b.target = best.slot;
    b.lastKnown = { x: best.x, y: best.y, z: best.z };
    b.lastKnownAge = 0;
    return;
  }
  b.target = null;
  // Gunfire nearby, or being hit, gives away roughly where someone is.
  for (const o of world.players) {
    if (o === p || !o.alive || o.sinceShot > DT * 1.5) continue;
    const d = Math.hypot(o.x - p.x, o.z - p.z);
    if (d < HEAR_RANGE || p.hurtTimer > 0.3) {
      b.lastKnown = { x: o.x, y: o.y, z: o.z };
      b.lastKnownAge = 0;
    }
  }
  // Now and then a rough guess at where someone is, so a quiet match keeps moving.
  b.huntTimer -= DT;
  if (b.huntTimer <= 0) {
    b.huntTimer = skill.huntEvery * (0.7 + 0.6 * nextFloat(world.rng));
    const others = world.players.filter((o) => o !== p && o.alive);
    const o = others[Math.floor(nextFloat(world.rng) * others.length)];
    if (o && b.lastKnownAge > 5) {
      b.lastKnown = { x: o.x + (nextFloat(world.rng) - 0.5) * 8, y: o.y, z: o.z + (nextFloat(world.rng) - 0.5) * 8 };
      b.lastKnownAge = 0;
    }
  }
}

/** Best weapon for the range: the rifle far off, the SMG close, the pistol otherwise. Never grenades. */
function chooseWeapon(world: World, p: Player, b: BotBrain, intent: PlayerIntent): void {
  const target = b.target !== null ? world.players[b.target] : null;
  const d = target ? Math.hypot(target.x - p.x, target.z - p.z) : 15;
  let best = -1;
  let bestScore = -Infinity;
  p.weapons.forEach((w, i) => {
    const def = world.data.weapons[w.id];
    if (!def || def.type === 'thrown') return;
    if (w.mag + (p.ammo[def.ammo] ?? 0) <= 0) return;
    const dps = (def.damage / def.fireInterval) * (def.spreadDeg > 2 && d > 15 ? 0.4 : 1);
    const scoped = (def.zoom ?? 1) > 1;
    const score = dps * (scoped ? (d > 14 ? 3 : 0.5) : 1);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  const want = best >= 0 && p.weapons[best] !== p.weapon && p.switchTimer <= 0 && p.weapon.reloadTimer <= 0;
  // The sim switches on the press, so release between requests.
  if (want && !b.switchPrev) intent.weaponSlot = best + 1;
  b.switchPrev = want && !b.switchPrev;
}

/** Turns toward the aim point (or the way it walks) at the skill's turn rate, with a wandering error. */
function look(world: World, p: Player, b: BotBrain, skill: BotSkill, intent: PlayerIntent, aim: NavPoint | null): void {
  b.errTimer -= DT;
  if (b.errTimer <= 0) {
    b.errYaw = (nextFloat(world.rng) - 0.5) * 2 * skill.aimError * DEG;
    b.errPitch = (nextFloat(world.rng) - 0.5) * skill.aimError * DEG;
    b.errTimer = 0.25 + nextFloat(world.rng) * 0.3;
  }
  let yaw: number;
  let pitch = 0;
  if (aim) {
    const eye = eyeOf(p);
    const d = Math.hypot(aim.x - p.x, aim.z - p.z);
    yaw = yawTo(p.x, p.z, aim.x, aim.z) + b.errYaw;
    pitch = Math.atan2(aim.y - eye, d) + b.errPitch;
  } else {
    const next = b.path[b.pathIndex];
    yaw = next ? yawTo(p.x, p.z, next.x, next.z) : p.yaw;
  }
  const max = skill.turnRate * DEG * DT;
  intent.lookYaw = clamp(angleDiff(p.yaw, yaw), -max, max);
  intent.lookPitch = clamp(pitch - p.pitch, -max, max);
}

function shoot(world: World, p: Player, b: BotBrain, skill: BotSkill, intent: PlayerIntent, aim: NavPoint, atPlayer: boolean): void {
  const def = world.data.weapons[p.weapon.id];
  if (!def || def.type === 'thrown' || p.switchTimer > 0) {
    b.firePrev = false;
    return;
  }
  const d = Math.hypot(aim.x - p.x, aim.z - p.z);
  if (atPlayer && skill.scope && (def.zoom ?? 1) > 1 && d > 14) intent.aim = true;
  b.reaction -= DT;
  b.burstTimer -= DT;
  // Fire once the crosshair is roughly on: within the target's half-width plus the aim wobble.
  const off = Math.abs(angleDiff(p.yaw, yawTo(p.x, p.z, aim.x, aim.z)));
  const onTarget = off < Math.atan2(0.45, d) + Math.abs(b.errYaw) + 0.02;
  const ready = (!atPlayer || b.reaction <= 0) && onTarget && b.burstTimer <= 0 && p.weapon.mag > 0 && (!intent.aim || p.zoom > 0.8);
  if (!ready) {
    b.firePrev = false;
    return;
  }
  if (def.auto) {
    intent.fire = true;
    // Lower skills fire short bursts with pauses.
    if (skill.burstPause > 0 && p.sinceShot === 0 && nextFloat(world.rng) < 0.2) b.burstTimer = skill.burstPause;
  } else {
    // Semi-automatic: press, release, press.
    intent.fire = !b.firePrev;
    if (intent.fire && skill.burstPause > 0) b.burstTimer = skill.burstPause * 0.4 * nextFloat(world.rng);
  }
  b.firePrev = intent.fire;
}

/** Picks where to go, follows the path there, and side-steps in a fight. */
function move(world: World, p: Player, b: BotBrain, skill: BotSkill, intent: PlayerIntent, target: Player | null, atBox: boolean): void {
  b.rethink -= DT;
  b.replan -= DT;
  if (target) {
    // In a fight: hold a comfortable range for the weapon, closing in through the path if far.
    const def = world.data.weapons[p.weapon.id];
    const [near, far] = (def?.zoom ?? 1) > 1 ? [10, 45] : def?.auto ? [3, 12] : [4, 16];
    const d = Math.hypot(target.x - p.x, target.z - p.z);
    if (d > far || !b.goal || b.goal.kind !== 'chase') {
      if (b.goal?.kind !== 'chase' || b.replan <= 0) setGoal(world, p, b, { kind: 'chase', x: target.x, y: target.y, z: target.z, index: target.slot });
    }
    b.strafeTimer -= DT;
    if (b.strafeTimer <= 0) {
      b.strafe = nextFloat(world.rng) < 0.5 ? 1 : -1;
      b.strafeTimer = 0.6 + nextFloat(world.rng) * 1.0;
    }
    const toward = yawTo(p.x, p.z, target.x, target.z);
    let mx = 0;
    let mz = 0;
    if (d > far) {
      const dir = pathDir(p, b);
      if (dir) [mx, mz] = [Math.sin(dir), -Math.cos(dir)];
    } else {
      // Forward or back along the line to the target, plus a side-step.
      const k = d < near ? -1 : d > (near + far) / 2 ? 0.6 : 0;
      mx = Math.sin(toward) * k;
      mz = -Math.cos(toward) * k;
      if (skill.strafe) {
        mx += Math.cos(toward) * b.strafe;
        mz += Math.sin(toward) * b.strafe;
      }
    }
    steer(p, intent, mx, mz, false);
  } else {
    // A goal that takes far too long (unreachable, or a pickup it cannot use) is dropped for a while.
    b.goalTime += DT;
    if (b.goal && b.goalTime > 6 + Math.hypot(b.goal.x - p.x, b.goal.z - p.z) / 2.5) {
      b.ignore.set(goalKey(b.goal), world.time + 15);
      b.goal = null;
      b.path = [];
    }
    if (b.rethink <= 0 || !b.goal || goalDone(world, p, b)) {
      b.rethink = 1;
      const g = pickGoal(world, p, b);
      if (g && (!b.goal || g.kind !== b.goal.kind || g.index !== b.goal.index || Math.hypot(g.x - b.goal.x, g.z - b.goal.z) > 2)) setGoal(world, p, b, g);
    }
    if (b.replan <= 0 && b.goal) setGoal(world, p, b, b.goal);
    const dir = pathDir(p, b);
    // Standing still while shooting a box in clear view; otherwise walk (and sprint on long straight runs).
    if (dir !== null && !atBox) {
      steer(p, intent, Math.sin(dir), -Math.cos(dir), b.path.length - b.pathIndex > 6);
    }
  }
  // Stuck against something (a barrel, a box, another player): hop and try again.
  const moved = Math.hypot(p.x - b.lastPos.x, p.z - b.lastPos.z);
  const trying = intent.moveX !== 0 || intent.moveZ !== 0;
  b.stuck = trying && moved < 0.02 ? b.stuck + DT : 0;
  b.lastPos = { x: p.x, z: p.z };
  const hop = b.stuck > 0.4;
  intent.jump = hop && !b.jumpPrev;
  b.jumpPrev = intent.jump;
  if (b.stuck > 0.9) {
    b.stuck = 0;
    b.strafe = b.strafe === 1 ? -1 : 1;
    b.replan = 0;
  }
}

/** Converts a world-space walk direction into the stick input for the bot's current facing. */
function steer(p: Player, intent: PlayerIntent, wx: number, wz: number, sprint: boolean): void {
  const l = Math.hypot(wx, wz);
  if (l < 1e-3) return;
  wx /= l;
  wz /= l;
  // forward = (sin, -cos), right = (cos, sin)
  intent.moveZ = wx * Math.sin(p.yaw) - wz * Math.cos(p.yaw);
  intent.moveX = wx * Math.cos(p.yaw) + wz * Math.sin(p.yaw);
  intent.sprint = sprint && intent.moveZ > 0.8;
}

/** Heading toward the next path point, advancing (and skipping corners) as points are reached. */
function pathDir(p: Player, b: BotBrain): number | null {
  while (b.pathIndex < b.path.length) {
    const n = b.path[b.pathIndex]!;
    if (Math.hypot(n.x - p.x, n.z - p.z) > ARRIVE || Math.abs(n.y - p.y) > 1.2) break;
    b.pathIndex++;
  }
  const n = b.path[b.pathIndex];
  return n ? yawTo(p.x, p.z, n.x, n.z) : null;
}

function goalKey(g: Goal): string {
  return g.index >= 0 ? `${g.kind}:${g.index}` : `${g.kind}:${Math.round(g.x)},${Math.round(g.z)}`;
}

function setGoal(world: World, p: Player, b: BotBrain, g: Goal): void {
  if (!b.goal || goalKey(b.goal) !== goalKey(g)) b.goalTime = 0;
  b.goal = g;
  b.replan = g.kind === 'chase' ? 0.5 : 2;
  const nav = botNav(world);
  const from = nodeAt(nav, p.x, p.y, p.z);
  const to = nodeAt(nav, g.x, g.y, g.z);
  const path = findBotPath(nav, from, to);
  b.path = path ? smooth(nav, { x: p.x, y: p.y, z: p.z }, path) : [];
  b.pathIndex = 0;
  if (!path) b.rethink = 0;
}

/** Drops path points that a straight walk on the same level can skip. */
function smooth(nav: ReturnType<typeof botNav>, start: NavPoint, path: NavPoint[]): NavPoint[] {
  const out: NavPoint[] = [];
  let from = start;
  let i = 0;
  while (i < path.length) {
    let j = i;
    while (j + 1 < path.length && j - i < 12 && walkableLine(nav, from, path[j + 1]!)) j++;
    out.push(path[j]!);
    from = path[j]!;
    i = j + 1;
  }
  return out;
}

function goalDone(world: World, p: Player, b: BotBrain): boolean {
  const g = b.goal!;
  if (g.kind === 'pickup') return !world.pickups[g.index]?.active;
  if (g.kind === 'box') return !world.props[g.index]?.alive;
  return Math.hypot(g.x - p.x, g.z - p.z) < 1.2 || b.pathIndex >= b.path.length;
}

/** What is worth walking to: health when hurt, guns and ammo it lacks, power-ups, boxes, the enemy. */
function pickGoal(world: World, p: Player, b: BotBrain): Goal | null {
  let best: Goal | null = null;
  let bestScore = 0;
  const consider = (g: Goal, value: number): void => {
    if ((b.ignore.get(goalKey(g)) ?? 0) > world.time) return;
    const s = value / (Math.hypot(g.x - p.x, g.z - p.z) + 6);
    if (s > bestScore) {
      bestScore = s;
      best = g;
    }
  };
  world.pickups.forEach((pk, i) => {
    if (!pk.active) return;
    const item = world.data.items[pk.item];
    if (!item) return;
    let v = 0;
    switch (item.kind) {
      case 'health':
        v = p.hp < PLAYER.maxHp ? (3 * (PLAYER.maxHp - p.hp)) / PLAYER.maxHp : 0;
        break;
      case 'armor':
        v = p.armor < 50 ? 1.2 : 0;
        break;
      case 'weapon': {
        const owned = p.weapons.some((w) => w.id === item.weapon);
        v = item.weapon === 'grenade' ? 0 : owned ? 0.3 : 2.5;
        break;
      }
      case 'ammo': {
        const owns = p.weapons.some((w) => world.data.weapons[w.id]?.ammo === item.ammo);
        v = owns && (p.ammo[item.ammo ?? ''] ?? 0) < 20 ? 1.5 : 0;
        break;
      }
      case 'powerup':
        v = item.effect === 'refill' ? (p.hp < 70 ? 2.5 : 0.3) : 2.5;
        break;
    }
    if (v > 0) consider({ kind: 'pickup', x: pk.x, y: pk.y, z: pk.z, index: i }, v);
  });
  world.props.forEach((pr, i) => {
    if (!pr.alive || !world.data.props[pr.kind]?.loot) return;
    const b0 = pr.box;
    consider({ kind: 'box', x: (b0.minX + b0.maxX) / 2, y: b0.minY, z: (b0.minZ + b0.maxZ) / 2, index: i }, 2);
  });
  if (b.lastKnown && b.lastKnownAge < 10) consider({ kind: 'hunt', ...b.lastKnown, index: -1 }, 3);
  if (!best) {
    // Nothing to do: roam to a random spawn point.
    const sp = world.spawns[Math.floor(nextFloat(world.rng) * world.spawns.length)] ?? world.starts[0];
    if (sp) return { kind: 'roam', x: sp.x, y: sp.y ?? 0, z: sp.z, index: -1 };
  }
  return best;
}
