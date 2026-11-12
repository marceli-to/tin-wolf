import { AI, PLAYER, TICK_RATE } from '../config';
import { angleDiff, clamp, DEG, yawTo } from '../core/math';
import { nextFloat, range } from '../core/rng';
import type { EnemyDef } from '../data/schema';
import { moveBody, updateVertical } from './collision';
import { fireHitscan } from './combat';
import { cellAt, worldToCell } from './grid';
import { clearLine } from './los';
import { canStep, findPath, type NavOptions } from './nav';
import { emit, spawnGuard, type Guard, type GuardState, type Noise, type Player, type World } from './world';

const TICKS_PER_THINK = Math.max(1, Math.round(TICK_RATE / AI.thinkRate));
const THINK_DT = TICKS_PER_THINK / TICK_RATE;
const TURN_RATE = 5.5;
const EYE = 1.55;
/** Guards notice someone this close regardless of facing. */
const NEAR_SENSE = 1.4;
const FOOTSTEP_RADIUS = 6;
/** Sprinting footsteps carry further. */
const SPRINT_FOOTSTEP_RADIUS = 11;
const ARRIVE = 0.4;
/** Eye height of a crouching guard (behind cover). */
const CROUCH_EYE = 0.95;
/** How far a guard looks for cover, and how close to the intruder a cover spot may be. */
const COVER_RADIUS = 9;
const COVER_MIN_TARGET_DIST = 4;
const COVER_HIDE: [number, number] = [1.2, 2.6];
const COVER_COOLDOWN: [number, number] = [3, 5];
/** Alerted guards only run for alarm panels this close (metres, straight line). */
const ALARM_RADIUS = 30;
const ALARM_REACH = 0.8;

export function guardEye(g: Guard): number {
  return g.crouching ? CROUCH_EYE : EYE;
}

export function guardDef(world: World, g: Guard): EnemyDef {
  return world.enemies[g.archetype]!;
}

function setState(world: World, g: Guard, s: GuardState): void {
  if (g.state === s) return;
  if (s === 'attack' && g.state !== 'attack') emit(world, { type: 'guardAlerted', id: g.id, x: g.x, y: g.y, z: g.z });
  const was = g.state;
  g.state = s;
  g.stateTime = 0;
  g.pathGoal = null;
  g.path = [];
  g.pathIndex = 0;
  if (s !== 'attack') {
    leaveCover(world, g);
    g.alarmTarget = null;
  }
  if (s === 'search') g.searchTime = guardDef(world, g).searchTime;
  if (s === 'patrol') g.awareness = 0;
  if (s === 'attack' && was !== 'attack') maybeRunForAlarm(world, g);
}

// ---- cover -------------------------------------------------------------------

function leaveCover(world: World, g: Guard): void {
  if (g.coverPhase) g.coverCooldown = range(world.rng, COVER_COOLDOWN[0], COVER_COOLDOWN[1]);
  g.cover = null;
  g.coverPhase = null;
  g.crouching = false;
}

function openAt(world: World, x: number, z: number, r: number): boolean {
  const [cx, cz] = worldToCell(world.grid, x, z);
  const c = cellAt(world.grid, cx, cz);
  if (!c || c.solid) return false;
  for (const b of world.terrain.boxes) if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r && b.maxY - b.minY > 0.3) return false;
  return true;
}

/**
 * A spot near the guard where a crouching body is hidden from the intruder: behind a prop at least
 * waist high, or beside a wall corner. The closest such spot wins.
 */
export function findCover(world: World, g: Guard, target: Player): { x: number; z: number } | null {
  const tx = target.x;
  const ty = target.y + playerEyeOf(target);
  const tz = target.z;
  const cands: { x: number; z: number }[] = [];
  for (const p of world.props) {
    if (!p.alive || !p.solid || p.box.maxY - p.box.minY < 0.8) continue;
    const cx = (p.box.minX + p.box.maxX) / 2;
    const cz = (p.box.minZ + p.box.maxZ) / 2;
    if (Math.hypot(cx - g.x, cz - g.z) > COVER_RADIUS) continue;
    let dx = cx - tx;
    let dz = cz - tz;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    const reach = Math.abs(dx) * (p.box.maxX - p.box.minX) * 0.5 + Math.abs(dz) * (p.box.maxZ - p.box.minZ) * 0.5 + g.radius + 0.2;
    cands.push({ x: cx + dx * reach, z: cz + dz * reach });
  }
  // Wall edges: open cells next to a solid one, around the guard.
  const s = world.grid.size;
  const [gcx, gcz] = worldToCell(world.grid, g.x, g.z);
  const span = Math.ceil(COVER_RADIUS / s);
  for (let cz = gcz - span; cz <= gcz + span; cz++) {
    for (let cx = gcx - span; cx <= gcx + span; cx++) {
      const c = cellAt(world.grid, cx, cz);
      if (!c || c.solid) continue;
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = cellAt(world.grid, cx + ox, cz + oz);
        if (n && n.solid) cands.push({ x: (cx + 0.5 + ox * 0.3) * s, z: (cz + 0.5 + oz * 0.3) * s });
      }
    }
  }
  let best: { x: number; z: number } | null = null;
  let bestD = Infinity;
  for (const c of cands) {
    const d = Math.hypot(c.x - g.x, c.z - g.z);
    if (d > COVER_RADIUS || d >= bestD) continue;
    if (Math.hypot(c.x - tx, c.z - tz) < COVER_MIN_TARGET_DIST) continue;
    if (!openAt(world, c.x, c.z, g.radius)) continue;
    const fy = g.y;
    // Body hidden when crouched (a waist-high crate leaves the top of the head showing, as in most shooters).
    if (clearLine(world, tx, ty, tz, c.x, fy + 0.75, c.z) || clearLine(world, tx, ty, tz, c.x, fy + 0.45, c.z)) continue;
    best = c;
    bestD = d;
  }
  return best;
}

function playerEyeOf(p: Player): number {
  return PLAYER.eyeHeight + (PLAYER.crouchEyeHeight - PLAYER.eyeHeight) * p.crouch;
}

/** Sends the guard to cover if there is some; true if it is on its way. */
export function takeCover(world: World, g: Guard): boolean {
  const target = g.targetSlot !== null ? world.players[g.targetSlot] : null;
  if (!target || g.coverPhase || g.coverCooldown > 0 || g.alarmTarget !== null) return false;
  const c = findCover(world, g, target);
  if (!c) return false;
  g.pathGoal = null;
  if (!setGoal(world, g, c.x, c.z)) return false;
  g.cover = c;
  g.coverPhase = 'moving';
  return true;
}

// ---- alarm -------------------------------------------------------------------

/** Where a guard stands to use an alarm panel: the open side of the panel nearest to `from`. */
export function alarmFront(world: World, index: number, from: { x: number; z: number }): { x: number; z: number } | null {
  const p = world.props[index];
  if (!p) return null;
  const cx = (p.box.minX + p.box.maxX) / 2;
  const cz = (p.box.minZ + p.box.maxZ) / 2;
  const hx = (p.box.maxX - p.box.minX) / 2 + 0.55;
  const hz = (p.box.maxZ - p.box.minZ) / 2 + 0.55;
  let best: { x: number; z: number } | null = null;
  let bestD = Infinity;
  for (const [ox, oz] of [[hx, 0], [-hx, 0], [0, hz], [0, -hz]] as const) {
    const x = cx + ox;
    const z = cz + oz;
    const [c, r] = worldToCell(world.grid, x, z);
    const cell = cellAt(world.grid, c, r);
    if (!cell || cell.solid) continue;
    const d = Math.hypot(x - from.x, z - from.z);
    if (d < bestD) {
      best = { x, z };
      bestD = d;
    }
  }
  return best;
}

function isAlarm(world: World, i: number): boolean {
  const p = world.props[i];
  return !!p && p.alive && !!world.data.props[p.kind]?.alarm;
}

/** The first guard to be alerted runs for the nearest intact alarm panel (one runner at a time). */
function maybeRunForAlarm(world: World, g: Guard): void {
  if (world.alarm.raised || world.guards.some((o) => o.alarmTarget !== null && o.state !== 'dead')) return;
  let best = -1;
  let bestD = ALARM_RADIUS;
  world.props.forEach((p, i) => {
    if (!isAlarm(world, i)) return;
    const d = Math.hypot((p.box.minX + p.box.maxX) / 2 - g.x, (p.box.minZ + p.box.maxZ) / 2 - g.z);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  if (best < 0) return;
  const front = alarmFront(world, best, g);
  if (!front || !setGoal(world, g, front.x, front.z)) return;
  g.alarmTarget = best;
  emit(world, { type: 'alarmRunner', id: g.id, x: g.x, z: g.z });
}

/** Every guard hunts the intruder, and the reinforcements arrive. */
export function raiseAlarm(world: World, by: Guard | null): void {
  if (world.alarm.raised) return;
  world.alarm = { raised: true, time: world.time };
  const slot = by?.targetSlot ?? world.players.find((p) => p.alive)?.slot ?? 0;
  const target = world.players[slot];
  emit(world, { type: 'alarmRaised', id: by?.id ?? '', x: by?.x ?? 0, y: by?.y ?? 0, z: by?.z ?? 0 });
  for (const e of world.reserves) spawnGuard(world, e);
  world.reserves = [];
  for (const o of world.guards) {
    if (o.state === 'dead') continue;
    o.alarmTarget = null;
    o.awareness = 1;
    o.targetSlot = slot;
    if (target) o.lastKnown = { x: target.x, z: target.z };
    if (o.state !== 'attack') o.reaction = guardDef(world, o).reactionTime;
    setState(world, o, 'attack');
    // Already fighting: re-plan toward the intruder's current position.
    o.pathGoal = null;
  }
}

function collectNoises(world: World, from = 0): Noise[] {
  const out: Noise[] = [];
  for (const e of world.events.slice(from)) {
    if (e.type === 'shotFired') {
      out.push({
        x: e.x,
        z: e.z,
        radius: e.noise,
        kind: 'shot',
        fromGuard: e.shooter.kind === 'guard' ? e.shooter.index : null,
        fromSlot: e.shooter.kind === 'player' ? e.shooter.slot : null,
      });
    } else if (e.type === 'explosion') {
      out.push({
        x: e.x,
        z: e.z,
        radius: e.noise,
        kind: 'shot',
        fromGuard: null,
        fromSlot: e.owner?.kind === 'player' ? e.owner.slot : null,
      });
    } else if (e.type === 'footstep') {
      out.push({ x: e.x, z: e.z, radius: e.loud ? SPRINT_FOOTSTEP_RADIUS : FOOTSTEP_RADIUS, kind: 'step', fromGuard: null, fromSlot: e.slot });
    }
  }
  return out;
}

function hear(world: World, g: Guard, def: EnemyDef, n: Noise): void {
  if (n.fromGuard === g.index) return;
  const d = Math.hypot(n.x - g.x, n.z - g.z);
  const radius = n.radius * def.hearingScale;
  if (d > radius) return;
  // Walls and closed doors muffle sound to half its range.
  if (d > radius * 0.5 && !clearLine(world, n.x, 1.5, n.z, g.x, g.y + guardEye(g), g.z)) return;
  if (n.kind === 'shot') {
    // A guard firing tells others where its target is; a player shot gives away the player.
    const other = n.fromGuard !== null ? world.guards[n.fromGuard] : null;
    const where = other?.lastKnown ?? { x: n.x, z: n.z };
    if (g.state !== 'attack' || !g.sees) g.lastKnown = { ...where };
    if (n.fromSlot !== null) g.targetSlot = n.fromSlot;
    else if (other?.targetSlot != null) g.targetSlot = other.targetSlot;
    g.awareness = 1;
    setState(world, g, 'attack');
    return;
  }
  if (g.state === 'patrol' || g.state === 'suspicious') {
    g.awareness = Math.min(0.95, g.awareness + 0.3);
    g.lastKnown = { x: n.x, z: n.z };
    setState(world, g, 'suspicious');
  }
}

function lightAt(world: World, x: number, z: number): number {
  const [cx, cz] = worldToCell(world.grid, x, z);
  return cellAt(world.grid, cx, cz)?.light ?? 1;
}

/** 0 if the guard cannot see the player, otherwise how fast awareness should build (higher = faster). */
export function sightFactor(world: World, g: Guard, def: EnemyDef, p: Player): number {
  if (!p.alive) return 0;
  const dx = p.x - g.x;
  const dz = p.z - g.z;
  const dist = Math.hypot(dx, dz);
  // Darkness and crouching shorten how far a guard can make someone out.
  const reach = def.visionRange * (0.4 + 0.6 * lightAt(world, p.x, p.z)) * (p.crouch > 0.5 ? 0.7 : 1);
  if (dist > reach) return 0;
  const off = Math.abs(angleDiff(g.yaw, yawTo(g.x, g.z, p.x, p.z)));
  const halfFov = (def.visionFovDeg * DEG) / 2;
  if (off > halfFov && dist > NEAR_SENSE) return 0;
  const ey = g.y + guardEye(g);
  const seen =
    clearLine(world, g.x, ey, g.z, p.x, p.y + p.height * 0.9, p.z) || clearLine(world, g.x, ey, g.z, p.x, p.y + p.height * 0.55, p.z);
  if (!seen) return 0;
  let f = clamp(1.6 - dist / reach, 0.25, 1.6);
  if (Math.hypot(p.vx, p.vz) > 2.5) f *= 1.4;
  if (off > halfFov * 0.5) f *= 0.6;
  return f;
}

// ---- navigation --------------------------------------------------------------

function navOptions(world: World): NavOptions {
  return {
    height: PLAYER.height,
    blocked: (cx, cz) => world.doors.some((d) => d.cx === cx && d.cz === cz && d.requires !== null && d.open < 0.95),
  };
}

/** Is a straight walk between two points free of walls, ledges and props? */
function walkable(world: World, ax: number, az: number, bx: number, bz: number, r: number): boolean {
  const grid = world.grid;
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 1e-3) return true;
  const ux = (bx - ax) / len;
  const uz = (bz - az) / len;
  const opts = navOptions(world);
  for (const off of [-r, 0, r]) {
    const ox = -uz * off;
    const oz = ux * off;
    let [pcx, pcz] = worldToCell(grid, ax + ox, az + oz);
    for (let t = 0; t <= len; t += 0.25) {
      const [cx, cz] = worldToCell(grid, ax + ux * t + ox, az + uz * t + oz);
      if (cx === pcx && cz === pcz) continue;
      if (cx !== pcx && cz !== pcz) {
        if (!(canStep(grid, pcx, pcz, cx, pcz, opts) && canStep(grid, cx, pcz, cx, cz, opts))) return false;
      } else if (!canStep(grid, pcx, pcz, cx, cz, opts)) return false;
      pcx = cx;
      pcz = cz;
    }
  }
  for (const b of world.terrain.boxes) {
    if (b.maxY - b.minY < 0.5) continue;
    const x0 = b.minX - r;
    const x1 = b.maxX + r;
    const z0 = b.minZ - r;
    const z1 = b.maxZ + r;
    // Already brushing against it: collision sliding handles that, so do not let it veto every line.
    if (ax > x0 && ax < x1 && az > z0 && az < z1) continue;
    if (segmentHitsRect(ax, az, bx, bz, x0, x1, z0, z1)) return false;
  }
  return true;
}

function segmentHitsRect(ax: number, az: number, bx: number, bz: number, x0: number, x1: number, z0: number, z1: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  for (const [p, q] of [
    [-dx, ax - x0],
    [dx, x1 - ax],
    [-dz, az - z0],
    [dz, z1 - az],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** Plans a path to (x, z). Returns false if unreachable. Keeps the current path if the goal is unchanged. */
export function setGoal(world: World, g: Guard, x: number, z: number): boolean {
  if (g.pathGoal && Math.hypot(g.pathGoal.x - x, g.pathGoal.z - z) < 0.75 && g.path.length) return true;
  const grid = world.grid;
  const [sx, sz] = worldToCell(grid, g.x, g.z);
  const [gx, gz] = worldToCell(grid, x, z);
  const cells = findPath(grid, sx, sz, gx, gz, navOptions(world));
  if (!cells) {
    g.path = [];
    g.pathGoal = null;
    return false;
  }
  const s = grid.size;
  // The first cell is the one we stand in; its centre may be blocked by a prop, so skip it.
  const pts = cells.slice(cells.length > 1 ? 1 : 0).map(([c, r]) => ({ x: (c + 0.5) * s, z: (r + 0.5) * s }));
  pts[pts.length - 1] = { x, z };
  // String-pull: from each kept point, jump to the farthest point we can walk to in a straight line.
  const out: { x: number; z: number }[] = [];
  let cur = { x: g.x, z: g.z };
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !walkable(world, cur.x, cur.z, pts[j]!.x, pts[j]!.z, g.radius + 0.05)) j--;
    out.push(pts[j]!);
    cur = pts[j]!;
    i = j + 1;
  }
  g.path = out;
  g.pathIndex = 0;
  g.pathGoal = { x, z };
  // stuckTime is only reset by real progress, so re-planning cannot hide a guard that is stuck.
  return true;
}

function atGoal(g: Guard): boolean {
  return g.pathIndex >= g.path.length;
}

// ---- think (10 Hz) ----------------------------------------------------------

function think(world: World, g: Guard, def: EnemyDef): void {
  let best: Player | null = null;
  let bestF = 0;
  for (const p of world.players) {
    const f = sightFactor(world, g, def, p);
    if (f > bestF) {
      bestF = f;
      best = p;
    }
  }
  const wasSeeing = g.sees;
  g.sees = !!best;
  if (best) {
    g.targetSlot = best.slot;
    g.lastKnown = { x: best.x, z: best.z };
  }

  switch (g.state) {
    case 'patrol':
    case 'suspicious':
    case 'search': {
      if (best) {
        g.awareness += (THINK_DT / def.noticeTime) * bestF * (g.state === 'search' ? 3 : 1);
        if (g.awareness >= 1) {
          g.awareness = 1;
          g.reaction = def.reactionTime;
          setState(world, g, 'attack');
          break;
        }
        if (g.state === 'patrol') setState(world, g, 'suspicious');
      } else if (g.state === 'suspicious') {
        g.awareness -= THINK_DT * 0.18;
        if (g.awareness <= 0) setState(world, g, 'patrol');
      }
      if (g.state === 'search') {
        g.searchTime -= THINK_DT;
        if (g.searchTime <= 0) setState(world, g, 'patrol');
        else if (atGoal(g) && g.lastKnown) pickSearchPoint(world, g);
      }
      break;
    }
    case 'attack': {
      if (best && !wasSeeing) g.reaction = Math.max(g.reaction, def.reactionTime * 0.6);
      if (!best) {
        const lk = g.lastKnown;
        const lost = !lk || Math.hypot(lk.x - g.x, lk.z - g.z) < 1.5 || (atGoal(g) && g.stateTime > 1);
        if (lost) setState(world, g, 'search');
      }
      break;
    }
    case 'dead':
      break;
  }
  planMovement(world, g, def);
}

function pickSearchPoint(world: World, g: Guard): void {
  const lk = g.lastKnown!;
  for (let attempt = 0; attempt < 6; attempt++) {
    const a = nextFloat(world.rng) * Math.PI * 2;
    const r = range(world.rng, 2, 7);
    const x = lk.x + Math.cos(a) * r;
    const z = lk.z + Math.sin(a) * r;
    const [cx, cz] = worldToCell(world.grid, x, z);
    const c = cellAt(world.grid, cx, cz);
    if (!c || c.solid) continue;
    g.pathGoal = null;
    if (setGoal(world, g, x, z)) return;
  }
}

function planMovement(world: World, g: Guard, def: EnemyDef): void {
  g.running = false;
  switch (g.state) {
    case 'patrol': {
      if (g.patrol.length) {
        const wp = g.patrol[g.patrolIndex % g.patrol.length]!;
        if (Math.hypot(wp.x - g.x, wp.z - g.z) < ARRIVE + 0.2) {
          g.patrolIndex = (g.patrolIndex + 1) % g.patrol.length;
          g.pathGoal = null;
        }
        const next = g.patrol[g.patrolIndex % g.patrol.length]!;
        setGoal(world, g, next.x, next.z);
      } else if (Math.hypot(g.post.x - g.x, g.post.z - g.z) > ARRIVE + 0.2) {
        setGoal(world, g, g.post.x, g.post.z);
      } else {
        g.path = [];
      }
      break;
    }
    case 'suspicious': {
      // Look first; if it keeps nagging, go and check where the noise or glimpse came from.
      if (g.stateTime > 1.5 && !g.sees && g.lastKnown) setGoal(world, g, g.lastKnown.x, g.lastKnown.z);
      else g.path = [];
      break;
    }
    case 'attack': {
      const target = g.targetSlot !== null ? world.players[g.targetSlot] : null;
      if (g.alarmTarget !== null) {
        // Running for the alarm: nothing else matters until it is raised or the panel is gone.
        const front = isAlarm(world, g.alarmTarget) ? alarmFront(world, g.alarmTarget, g) : null;
        if (front && setGoal(world, g, front.x, front.z)) {
          g.running = true;
          break;
        }
        g.alarmTarget = null;
      }
      if (g.coverPhase === 'moving' && g.cover) {
        g.running = true;
        if (!setGoal(world, g, g.cover.x, g.cover.z)) leaveCover(world, g);
        break;
      }
      if (g.coverPhase === 'hiding') {
        g.path = [];
        break;
      }
      if (g.sees && target) {
        const d = Math.hypot(target.x - g.x, target.z - g.z);
        // Close in when far away; otherwise hold position and shoot.
        if (d > def.visionRange * 0.55) {
          g.running = true;
          setGoal(world, g, target.x, target.z);
        } else g.path = [];
      } else if (g.lastKnown) {
        g.running = true;
        if (!setGoal(world, g, g.lastKnown.x, g.lastKnown.z)) setState(world, g, 'search');
      }
      break;
    }
    case 'search':
      break;
    case 'dead':
      g.path = [];
      break;
  }
}

// ---- act (60 Hz) -------------------------------------------------------------

function act(world: World, g: Guard, def: EnemyDef, dt: number): void {
  const target = g.targetSlot !== null ? world.players[g.targetSlot] : null;
  let speed = 0;
  if (g.flinch <= 0 && g.pathIndex < g.path.length) {
    let wp = g.path[g.pathIndex]!;
    if (Math.hypot(wp.x - g.x, wp.z - g.z) < ARRIVE) {
      g.pathIndex++;
      wp = g.path[g.pathIndex] ?? wp;
    }
    if (g.pathIndex < g.path.length) {
      speed = g.running ? def.runSpeed : g.state === 'search' ? def.walkSpeed * 1.4 : def.walkSpeed;
      const dx = wp.x - g.x;
      const dz = wp.z - g.z;
      const d = Math.hypot(dx, dz) || 1;
      g.vx = (dx / d) * speed;
      g.vz = (dz / d) * speed;
      if (!(g.state === 'attack' && g.sees && g.alarmTarget === null)) g.aimYaw = Math.atan2(dx, -dz);
    }
  }
  if (speed === 0) {
    g.vx = 0;
    g.vz = 0;
  }

  // Facing.
  if (g.state === 'attack' && g.sees && target && g.alarmTarget === null) {
    g.aimYaw = yawTo(g.x, g.z, target.x, target.z);
    const hd = Math.hypot(target.x - g.x, target.z - g.z);
    g.aimPitch = Math.atan2(target.y + target.height * 0.62 - (g.y + guardEye(g)), hd);
  } else if ((g.state === 'suspicious' || g.state === 'attack') && g.lastKnown && speed === 0) {
    g.aimYaw = yawTo(g.x, g.z, g.lastKnown.x, g.lastKnown.z);
    g.aimPitch = 0;
  } else if (g.state === 'patrol' && speed === 0 && !g.patrol.length) {
    g.aimYaw = g.post.yaw;
    g.aimPitch = 0;
  } else if (g.state === 'search' && speed === 0) {
    // Glance around while searching.
    g.aimYaw += Math.sin(g.stateTime * 1.3) * dt * 1.5;
  }
  const turn = angleDiff(g.yaw, g.aimYaw);
  const maxTurn = TURN_RATE * dt * (g.state === 'attack' ? 1.4 : 1);
  g.yaw += clamp(turn, -maxTurn, maxTurn);

  if (speed > 0) {
    const bx = g.x;
    const bz = g.z;
    moveBody(world.terrain, g, g.vx * dt, g.vz * dt);
    g.stepDist += Math.hypot(g.x - bx, g.z - bz);
    if (g.stepDist > 1.6) {
      g.stepDist = 0;
      emit(world, { type: 'guardStep', x: g.x, z: g.z, running: g.running });
    }
    // Stuck detection: no real progress for a while means re-plan, then give up on this goal.
    const moved = Math.hypot(g.x - g.lastProgress.x, g.z - g.lastProgress.z);
    if (moved > 0.4) {
      g.lastProgress = { x: g.x, z: g.z };
      g.stuckTime = 0;
    } else {
      g.stuckTime += dt;
      if (g.stuckTime > 0.8 && g.stuckTime - dt <= 0.8) {
        const goal = g.pathGoal;
        g.pathGoal = null;
        if (goal) setGoal(world, g, goal.x, goal.z);
      }
      if (g.stuckTime > 1.6) {
        g.path = [];
        g.pathGoal = null;
        g.stuckTime = 0;
        g.lastProgress = { x: g.x, z: g.z };
        if (g.state === 'patrol' && g.patrol.length) g.patrolIndex = (g.patrolIndex + 1) % g.patrol.length;
        if (g.state === 'attack' && !g.sees) setState(world, g, 'search');
      }
    }
  } else {
    g.lastProgress = { x: g.x, z: g.z };
    g.stuckTime = 0;
  }
  updateVertical(world.terrain, g, dt);

  // Cover: arrive and crouch, hide for a while, then stand and fight again.
  if (g.coverPhase === 'moving' && g.cover && Math.hypot(g.cover.x - g.x, g.cover.z - g.z) < 0.6) {
    g.coverPhase = 'hiding';
    g.crouching = true;
    g.coverTimer = range(world.rng, COVER_HIDE[0], COVER_HIDE[1]);
    g.path = [];
  } else if (g.coverPhase === 'hiding') {
    g.coverTimer -= dt;
    if (g.coverTimer <= 0) leaveCover(world, g);
  }
  g.height = g.crouching ? PLAYER.crouchHeight : PLAYER.height;

  // Alarm: the runner reaches the panel.
  if (g.alarmTarget !== null) {
    const front = alarmFront(world, g.alarmTarget, g);
    if (front && Math.hypot(front.x - g.x, front.z - g.z) < ALARM_REACH && isAlarm(world, g.alarmTarget)) raiseAlarm(world, g);
    return;
  }

  // Shooting.
  if (g.state !== 'attack' || !g.sees || !target || !target.alive || g.flinch > 0) return;
  g.reaction -= dt;
  if (g.reaction > 0 || g.fireCooldown > 0 || Math.abs(turn) > 0.25) return;
  const weapon = world.data.weapons[def.weapon];
  if (!weapon) return;
  if (g.burstLeft <= 0) g.burstLeft = Math.round(range(world.rng, def.burst[0], def.burst[1] + 0.999) - 0.5) || 1;
  const moving = Math.hypot(target.vx, target.vz) > 2 ? 1.4 : 1;
  const scaled = { ...weapon, damage: weapon.damage * def.damageScale };
  fireHitscan(world, { kind: 'guard', index: g.index }, g.x, g.y + guardEye(g), g.z, g.yaw, g.aimPitch, scaled, def.weapon, def.aimSpreadDeg * moving);
  g.sinceShot = 0;
  g.burstLeft--;
  g.fireCooldown = g.burstLeft > 0 ? weapon.fireInterval * 1.6 : range(world.rng, def.burstPause[0], def.burstPause[1]);
  // End of a burst: some guards duck behind cover before the next one.
  if (g.burstLeft <= 0 && !g.coverPhase && def.cover > 0 && nextFloat(world.rng) < def.cover) takeCover(world, g);
}

/** Per-tick guard update. Perception and decisions run at AI.thinkRate, staggered by guard index. */
export function updateGuards(world: World, dt: number): void {
  const noises = [...world.noiseCarry, ...collectNoises(world)];
  const eventsBefore = world.events.length;
  for (const g of world.guards) {
    g.prev.x = g.x;
    g.prev.y = g.y;
    g.prev.z = g.z;
    g.prev.yaw = g.yaw;
    if (g.state === 'dead') {
      g.deadTime += dt;
      g.vx = g.vz = 0;
      g.alarmTarget = null;
      g.crouching = false;
      continue;
    }
    const def = guardDef(world, g);
    g.stateTime += dt;
    g.sinceShot += dt;
    g.coverCooldown = Math.max(0, g.coverCooldown - dt);
    g.fireCooldown = Math.max(0, g.fireCooldown - dt);
    if (g.flinch > 0) {
      g.flinch = Math.max(0, g.flinch - dt);
      // Being shot ruins aim.
      g.reaction = Math.max(g.reaction, 0.25);
    }
    if (g.lastHurtBy) {
      if (g.lastHurtBy.kind === 'player') {
        const p = world.players[g.lastHurtBy.slot];
        if (p) {
          g.targetSlot = p.slot;
          g.lastKnown = { x: p.x, z: p.z };
        }
      }
      g.lastHurtBy = null;
      g.awareness = 1;
      if (g.state !== 'attack') {
        g.reaction = def.reactionTime;
        setState(world, g, 'attack');
      } else if (g.hp < def.hp * 0.5 && def.cover > 0 && !g.coverPhase) {
        // Badly hurt in a fight: get out of the line of fire.
        takeCover(world, g);
      }
    }
    for (const n of noises) hear(world, g, def, n);
    if ((world.tick + g.index) % TICKS_PER_THINK === 0) think(world, g, def);
    act(world, g, def, dt);
  }
  world.noiseCarry = collectNoises(world, eventsBefore);
}
