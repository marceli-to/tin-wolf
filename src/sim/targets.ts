import type { Ray } from './raycast';
import { emit, reviveGuard, type Player, type World } from './world';

/** Seconds a hit target lies flat before it pops up again (outside a course run). */
export const TARGET_POP_TIME = 2.5;
/** Seconds a downed guard (practice dummy) lies there before it is back at its post (outside a course run). */
export const GUARD_REVIVE_TIME = 5;
/** Rates at which a target falls and stands up (fraction per second). */
const FALL_RATE = 7;
const RISE_RATE = 3.5;
/** Shots only count while a target is (nearly) upright. */
const HITTABLE = 0.85;
/** Bullseye: the centre ring, as a fraction of the board radius. */
export const BULLSEYE = 0.28;

/** A round target board on a post. It falls back when hit and pops up again later. */
export interface Target {
  id: string;
  /** Centre of the board. */
  x: number;
  y: number;
  z: number;
  /** Height of the floor under the post. */
  baseY: number;
  /** Direction the face looks toward (game yaw: forward = (sin, -cos)). */
  yaw: number;
  radius: number;
  /** 0 lying flat .. 1 upright (animated by the sim, read by the renderer). */
  up: number;
  standing: boolean;
  /** Seconds until a fallen target stands up again; < 0 = stays down. */
  timer: number;
  /** Moving target: slides back and forth between a and b. */
  rail: { ax: number; az: number; bx: number; bz: number; speed: number; t: number; dir: 1 | -1 } | null;
  /** Hit during the current course run. */
  done: boolean;
}

/** The timed course of a training ground: started at a start panel, done when every target and guard is down. */
export interface CourseState {
  running: boolean;
  slot: number;
  time: number;
  hits: number;
  total: number;
  /** The runner's shot counters when the run started, for accuracy. */
  shots0: number;
  hits0: number;
}

/** Board hit test: the ray against the target's disc, from either side. */
export function rayTarget(ray: Ray, t: Target, maxT: number): { t: number; off: number } | null {
  const nx = Math.sin(t.yaw);
  const nz = -Math.cos(t.yaw);
  const denom = ray.dx * nx + ray.dz * nz;
  if (Math.abs(denom) < 1e-6) return null;
  const d = ((t.x - ray.ox) * nx + (t.z - ray.oz) * nz) / denom;
  if (d < 0 || d > maxT) return null;
  const px = ray.ox + ray.dx * d - t.x;
  const py = ray.oy + ray.dy * d - t.y;
  const pz = ray.oz + ray.dz * d - t.z;
  const off = Math.hypot(px, py, pz);
  return off <= t.radius ? { t: d, off: off / t.radius } : null;
}

export function targetHittable(t: Target): boolean {
  return t.standing && t.up >= HITTABLE;
}

/** Knocks a target down. `off` is the hit's distance from the centre (0..1; null for blasts). */
export function hitTarget(world: World, index: number, shooter: Player | null, off: number | null): void {
  const t = world.targets[index];
  if (!t || !targetHittable(t)) return;
  t.standing = false;
  const bullseye = off !== null && off <= BULLSEYE;
  if (shooter) shooter.shotsHit++;
  const c = world.course;
  if (c?.running) {
    // During a run a target stays down until the course is done.
    t.timer = -1;
    if (!t.done) {
      t.done = true;
      c.hits++;
    }
  } else {
    t.timer = TARGET_POP_TIME;
  }
  emit(world, { type: 'targetHit', id: t.id, x: t.x, y: t.y, z: t.z, bullseye, slot: shooter?.slot ?? null });
  if (c?.running && c.hits >= c.total) finishCourse(world);
}

/** A guard went down: counts toward a running course like a target. */
function guardDown(world: World): void {
  const c = world.course;
  if (!c?.running) return;
  c.hits++;
  if (c.hits >= c.total) finishCourse(world);
}

function startCourse(world: World, slot: number): void {
  const p = world.players[slot];
  if (!p) return;
  for (const t of world.targets) {
    t.standing = true;
    t.timer = 0;
    t.done = false;
  }
  // Every guard is back at its post for a fresh run.
  world.guards.forEach((_, i) => reviveGuard(world, i));
  const total = world.targets.length + world.guards.length;
  world.course = { running: true, slot, time: 0, hits: 0, total, shots0: p.shotsFired, hits0: p.shotsHit };
  emit(world, { type: 'courseStarted', slot, total });
}

function finishCourse(world: World): void {
  const c = world.course!;
  const p = world.players[c.slot];
  const shots = p ? p.shotsFired - c.shots0 : 0;
  const hits = p ? p.shotsHit - c.hits0 : 0;
  c.running = false;
  // Everything stands up again shortly after.
  for (const t of world.targets) t.timer = 2;
  emit(world, { type: 'courseDone', slot: c.slot, time: c.time, accuracy: shots > 0 ? Math.min(1, hits / shots) : 1 });
}

/** Moves and animates targets, runs the course, and keeps everyone's ammo topped up. */
export function updateTargets(world: World, dt: number): void {
  if (world.level.mode !== 'training') return;
  // Guards downed this tick count first, so one that falls as a run starts is not counted twice.
  for (const e of world.events) if (e.type === 'died' && e.target.kind === 'guard') guardDown(world);
  // A start panel starts (or restarts) the course; it can be used again at once.
  for (const e of world.events) {
    if (e.type !== 'used') continue;
    const prop = world.props.find((p) => p.id === e.id);
    if (prop?.kind !== 'start_panel') continue;
    prop.used = false;
    startCourse(world, e.slot);
  }
  // Outside a run, downed guards come back after a while.
  if (!world.course?.running) {
    world.guards.forEach((g, i) => {
      if (g.state === 'dead' && g.deadTime > GUARD_REVIVE_TIME) reviveGuard(world, i);
    });
  }
  if (world.course?.running) world.course.time += dt;
  for (const t of world.targets) {
    if (!t.standing && t.timer > 0) {
      t.timer -= dt;
      if (t.timer <= 0) t.standing = true;
    }
    t.up = t.standing ? Math.min(1, t.up + RISE_RATE * dt) : Math.max(0, t.up - FALL_RATE * dt);
    const r = t.rail;
    if (r && t.standing) {
      const len = Math.hypot(r.bx - r.ax, r.bz - r.az) || 1;
      r.t += (r.dir * r.speed * dt) / len;
      if (r.t >= 1) {
        r.t = 1;
        r.dir = -1;
      } else if (r.t <= 0) {
        r.t = 0;
        r.dir = 1;
      }
      t.x = r.ax + (r.bx - r.ax) * r.t;
      t.z = r.az + (r.bz - r.az) * r.t;
    }
  }
  // Practice never runs dry: reserves stay full (magazines and reloading work as usual).
  for (const p of world.players) {
    for (const w of p.weapons) {
      const def = world.data.weapons[w.id];
      if (def) p.ammo[def.ammo] = Math.max(p.ammo[def.ammo] ?? 0, def.maxReserve);
    }
  }
}
