import { PLAYER } from '../config';
import { createRng, type Rng } from '../core/rng';
import { DEG } from '../core/math';
import type { GameData } from '../data';
import { scaleEnemy, type EnemyDef, type EntityDef, type LevelDef } from '../data/schema';
import type { Box, Terrain } from './collision';
import type { CourseState, Target } from './targets';
import { createBrain, type BotBrain } from './bot';
import type { ActorRef, SimEvent } from './events';
import type { BodyShape } from './hitbox';
import { buildGrid, cellCenter, floorAtWorld, type Grid } from './grid';
import { createMatch, type MatchState } from './match';
import { createMission, type MissionState } from './objectives';

export interface WeaponState {
  id: string;
  /** Rounds in the magazine (unused by thrown weapons, which draw from the pool). */
  mag: number;
  cooldown: number;
  /** > 0 while reloading; counts down. */
  reloadTimer: number;
}

export interface Player {
  slot: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  vy: number;
  yaw: number;
  pitch: number;
  radius: number;
  height: number;
  /** 0 standing .. 1 fully crouched. */
  crouch: number;
  grounded: boolean;
  prev: { x: number; y: number; z: number; crouch: number };
  hp: number;
  armor: number;
  alive: boolean;
  deadTimer: number;
  protect: number;
  hurtTimer: number;
  /** The weapon in hand; always one of `weapons`. */
  weapon: WeaponState;
  /** Owned weapons, in pickup order. */
  weapons: WeaponState[];
  /** Reserve rounds per ammo pool. */
  ammo: Record<string, number>;
  /** > 0 while lowering one weapon and raising the next. */
  switchTimer: number;
  switchPrev: boolean;
  inventory: string[];
  firePrev: boolean;
  interactPrev: boolean;
  reloadPrev: boolean;
  /** Seconds since the last shot, for recoil animation. */
  sinceShot: number;
  stepDist: number;
  /** Running forward with sprint held (faster, louder footsteps). */
  sprinting: boolean;
  jumpPrev: boolean;
  /** 0 hip .. 1 fully scoped in (weapons with `zoom`). */
  zoom: number;
  /** A computer player: the sim makes its intents (src/sim/bot.ts). */
  bot: boolean;
  /** Seconds left on each timed power-up (0 = off). `tiny` is set on the victim of a Shrink Ray. */
  power: PowerTimers;
  kills: number;
  deaths: number;
  shotsFired: number;
  shotsHit: number;
}

export interface PowerTimers {
  speed: number;
  shield: number;
  damage: number;
  jump: number;
  tiny: number;
}

export type PowerName = keyof PowerTimers;

export function noPowers(): PowerTimers {
  return { speed: 0, shield: 0, damage: 0, jump: 0, tiny: 0 };
}

/** Something guards can hear. */
export interface Noise {
  x: number;
  z: number;
  radius: number;
  kind: 'shot' | 'step';
  fromGuard: number | null;
  fromSlot: number | null;
}

export type GuardState = 'patrol' | 'suspicious' | 'attack' | 'search' | 'dead';

/** Guard state. Behaviour lives in sim/ai; combat only touches hp, flinch and lastHurtBy. */
export interface Guard {
  index: number;
  id: string;
  archetype: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  vy: number;
  radius: number;
  height: number;
  grounded: boolean;
  yaw: number;
  /** Desired facing; the body turns toward it at a limited rate. */
  aimYaw: number;
  aimPitch: number;
  prev: { x: number; y: number; z: number; yaw: number };
  hp: number;
  state: GuardState;
  /** 0..1 how sure the guard is that someone is there. 1 means attack. */
  awareness: number;
  /** Where the guard believes the intruder is. */
  lastKnown: { x: number; z: number } | null;
  targetSlot: number | null;
  sees: boolean;
  /** Seconds before the first shot after spotting someone. */
  reaction: number;
  burstLeft: number;
  fireCooldown: number;
  stateTime: number;
  searchTime: number;
  flinch: number;
  lastHurtBy: ActorRef | null;
  deadTime: number;
  sinceShot: number;
  patrol: { x: number; z: number }[];
  patrolIndex: number;
  post: { x: number; z: number; yaw: number };
  path: { x: number; z: number }[];
  pathIndex: number;
  /** Where the current path leads, to avoid re-planning to the same goal. */
  pathGoal: { x: number; z: number } | null;
  stuckTime: number;
  lastProgress: { x: number; z: number };
  running: boolean;
  stepDist: number;
  /** Render-only: uniform colour for the model. */
  uniform: string | null;
  /** Render-only: outfit name. */
  look: string | null;
  /** Cover spot the guard is heading to or hiding at, and for how long it hides there. */
  cover: { x: number; z: number } | null;
  coverPhase: 'moving' | 'hiding' | null;
  coverTimer: number;
  /** Seconds before the guard may take cover again. */
  coverCooldown: number;
  crouching: boolean;
  /** Index of the alarm panel (in world.props) the guard is running to, or null. */
  alarmTarget: number | null;
  /** Seconds left shrunk by a Shrink Ray. */
  tiny: number;
}

export interface Prop {
  id: string;
  kind: string;
  box: Box;
  solid: boolean;
  yaw: number;
  hp: number;
  maxHp: number;
  destructible: boolean;
  usable: boolean;
  used: boolean;
  alive: boolean;
  mat: string;
  /** Surprise box: fixed drop (null = random from the kind's loot). */
  drop: string | null;
  /** Surprise box: seconds to come back after the drop is taken (null = never). */
  respawn: number | null;
  /** Surprise box: index in world.pickups of the item it dropped last, while that is still lying there. */
  dropped: number | null;
  /** Surprise box: counts down to coming back once the drop is gone. */
  timer: number;
}

export interface Door {
  id: string;
  cx: number;
  cz: number;
  /** Door panel spans x (true) or z (false). */
  alongX: boolean;
  requires: string | null;
  /** 0 closed .. 1 open. */
  open: number;
  target: number;
  closeTimer: number;
  floor: number;
  height: number;
  mat: string;
}

export interface Pickup {
  id: string;
  item: string;
  amount: number;
  x: number;
  y: number;
  z: number;
  respawn: number | null;
  timer: number;
  active: boolean;
}

/** A thrown grenade in flight. */
export interface Projectile {
  id: number;
  weapon: string;
  owner: ActorRef;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
  prev: { x: number; y: number; z: number };
}

export interface Zone {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface SpawnPoint {
  x: number;
  z: number;
  yaw: number;
  /** Feet height; absent means the floor of the cell. */
  y?: number;
}

export interface World {
  level: LevelDef;
  data: GameData;
  grid: Grid;
  tick: number;
  time: number;
  rng: Rng;
  /** Body proportions the hit zones follow. */
  body: BodyShape;
  /** Guard archetypes with the difficulty applied; the AI reads these, not data.enemies. */
  enemies: Record<string, EnemyDef>;
  players: Player[];
  guards: Guard[];
  props: Prop[];
  doors: Door[];
  pickups: Pickup[];
  projectiles: Projectile[];
  nextProjectile: number;
  zones: Zone[];
  spawns: SpawnPoint[];
  starts: SpawnPoint[];
  events: SimEvent[];
  match: MatchState | null;
  mission: MissionState | null;
  /** Noises made by guards late in the previous tick, heard at the start of this one. */
  noiseCarry: Noise[];
  /** Collision obstacles, rebuilt each tick from props and doors. */
  terrain: Terrain;
  /** Set once a guard reaches an alarm panel. */
  alarm: { raised: boolean; time: number };
  /** Reinforcements waiting for the alarm (guard entities with `reserve`). */
  reserves: GuardEntity[];
  /** Explosions waiting to go off (explosive props, a moment after they break: chains ripple). */
  blasts: PendingBlast[];
  /** Training: target boards and the timed course. */
  targets: Target[];
  course: CourseState | null;
  /** Computer players' brains, by slot (null for people). */
  brains: (BotBrain | null)[];
  /** Key of BOT_SKILL the computer players use. */
  botSkill: string;
}

export type GuardEntity = Extract<EntityDef, { type: 'guard' }>;

export interface Blast {
  radius: number;
  damage: number;
  noise: number;
}

export interface PendingBlast extends Blast {
  x: number;
  y: number;
  z: number;
  /** Who set it off (gets the credit and can be hurt by it); null if nobody. */
  owner: ActorRef | null;
  timer: number;
}

export interface WorldOptions {
  players: number;
  seed?: number;
  /** Body proportions for hit zones (default 'human'). */
  body?: BodyShape;
  /** Key of data.difficulty (default 'normal'); also the computer players' skill. */
  difficulty?: string;
  /** Computer players, after the `players` people (versus). */
  bots?: number;
}

export function createPlayer(slot: number, loadout: readonly string[], data: GameData): Player {
  const p: Player = {
    slot,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    yaw: 0,
    pitch: 0,
    radius: PLAYER.radius,
    height: PLAYER.height,
    crouch: 0,
    grounded: true,
    prev: { x: 0, y: 0, z: 0, crouch: 0 },
    hp: PLAYER.maxHp,
    armor: 0,
    alive: true,
    deadTimer: 0,
    protect: 0,
    hurtTimer: 0,
    weapon: { id: '', mag: 0, cooldown: 0, reloadTimer: 0 },
    weapons: [],
    ammo: {},
    switchTimer: 0,
    switchPrev: false,
    inventory: [],
    firePrev: false,
    interactPrev: false,
    reloadPrev: false,
    sinceShot: 10,
    stepDist: 0,
    sprinting: false,
    jumpPrev: false,
    zoom: 0,
    bot: false,
    power: noPowers(),
    kills: 0,
    deaths: 0,
    shotsFired: 0,
    shotsHit: 0,
  };
  giveLoadout(p, loadout, data);
  return p;
}

/** Replaces a player's weapons and ammo with a fresh loadout; the first weapon is drawn. */
export function giveLoadout(p: Player, loadout: readonly string[], data: GameData): void {
  p.weapons = [];
  p.ammo = {};
  for (const id of loadout) {
    const def = data.weapons[id];
    if (!def) throw new Error(`Unknown weapon '${id}'`);
    if (p.weapons.some((w) => w.id === id)) continue;
    p.weapons.push({ id, mag: def.magSize, cooldown: 0, reloadTimer: 0 });
    p.ammo[def.ammo] = Math.min(def.maxReserve, (p.ammo[def.ammo] ?? 0) + def.startReserve);
  }
  p.weapon = p.weapons[0]!;
  p.switchTimer = 0;
}

export function placePlayer(world: World, p: Player, sp: SpawnPoint): void {
  p.x = sp.x;
  p.z = sp.z;
  p.y = sp.y ?? floorAtWorld(world.grid, sp.x, sp.z) ?? 0;
  p.prev = { x: p.x, y: p.y, z: p.z, crouch: 0 };
  p.yaw = sp.yaw;
  p.pitch = 0;
  p.vx = p.vz = p.vy = 0;
  p.grounded = true;
  p.crouch = 0;
}

function scaledEnemies(data: GameData, difficulty = 'normal'): Record<string, EnemyDef> {
  const d = data.difficulty[difficulty] ?? data.difficulty.normal;
  if (!d) return data.enemies;
  return Object.fromEntries(Object.entries(data.enemies).map(([k, def]) => [k, scaleEnemy(def, d)]));
}

export function createWorld(level: LevelDef, data: GameData, opts: WorldOptions): World {
  const grid = buildGrid(level);
  const world: World = {
    level,
    data,
    grid,
    tick: 0,
    time: 0,
    rng: createRng(opts.seed ?? 1),
    body: opts.body ?? 'human',
    enemies: scaledEnemies(data, opts.difficulty),
    players: [],
    guards: [],
    props: [],
    doors: [],
    pickups: [],
    projectiles: [],
    nextProjectile: 1,
    zones: [],
    spawns: [],
    starts: [],
    events: [],
    noiseCarry: [],
    mission: level.mode === 'mission' ? createMission(level.objectives) : null,
    match: level.mode === 'versus' && level.match ? createMatch(level.match.killLimit, level.match.timeLimit) : null,
    terrain: { grid, boxes: [] },
    alarm: { raised: false, time: 0 },
    blasts: [],
    targets: [],
    course: null,
    reserves: [],
    brains: [],
    botSkill: opts.difficulty ?? 'normal',
  };
  const s = grid.size;
  let auto = 0;
  const nextId = (prefix: string): string => `${prefix}_${auto++}`;
  for (const e of level.entities) {
    const [c, r] = e.cell;
    // Fractional cells address points inside a cell; integer cells mean its centre.
    const x = Number.isInteger(c) ? (c + 0.5) * s : c * s;
    const z = Number.isInteger(r) ? (r + 0.5) * s : r * s;
    switch (e.type) {
      case 'playerStart':
        world.starts[e.slot] = { x, z, yaw: e.yaw * DEG, y: (floorAtWorld(grid, x, z) ?? 0) + e.elevation };
        break;
      case 'spawn':
        world.spawns.push({ x, z, yaw: e.yaw * DEG, y: (floorAtWorld(grid, x, z) ?? 0) + e.elevation });
        break;
      case 'prop': {
        const kind = data.props[e.kind];
        if (!kind) throw new Error(`Unknown prop kind '${e.kind}'`);
        const [sx, sy, sz] = e.size ?? kind.size;
        const rot = Math.round(e.yaw / 90) % 2 !== 0;
        const hx = (rot ? sz : sx) / 2;
        const hz = (rot ? sx : sz) / 2;
        const fy = (floorAtWorld(grid, x, z) ?? 0) + e.elevation;
        const hp = e.hp ?? kind.hp ?? 0;
        world.props.push({
          id: e.id ?? nextId(e.kind),
          kind: e.kind,
          box: { minX: x - hx, maxX: x + hx, minY: fy, maxY: fy + sy, minZ: z - hz, maxZ: z + hz },
          solid: kind.solid,
          yaw: e.yaw * DEG,
          hp,
          maxHp: hp,
          destructible: hp > 0,
          usable: kind.usable,
          used: false,
          alive: true,
          mat: level.retexture[kind.mat] ?? kind.mat,
          drop: e.drop ?? null,
          respawn: e.respawn ?? (level.mode === 'versus' ? (kind.respawn ?? null) : null),
          dropped: null,
          timer: 0,
        });
        break;
      }
      case 'target': {
        const big = e.size === 'big';
        const baseY = (floorAtWorld(grid, x, z) ?? 0) + e.elevation;
        const end = e.to ? { x: (e.to[0] + (Number.isInteger(e.to[0]) ? 0.5 : 0)) * s, z: (e.to[1] + (Number.isInteger(e.to[1]) ? 0.5 : 0)) * s } : null;
        world.targets.push({
          id: e.id ?? nextId('target'),
          x,
          y: baseY + (big ? 1.35 : 1.15),
          z,
          baseY,
          yaw: e.yaw * DEG,
          radius: big ? 0.45 : 0.26,
          up: 1,
          standing: true,
          timer: 0,
          rail: end ? { ax: x, az: z, bx: end.x, bz: end.z, speed: e.speed, t: 0, dir: 1 } : null,
          done: false,
        });
        break;
      }
      case 'door': {
        const cx = Math.floor(c);
        const cz = Math.floor(r);
        const cell = grid.cells[cz * grid.w + cx]!;
        const westSolid = grid.cells[cz * grid.w + cx - 1]?.solid ?? true;
        const eastSolid = grid.cells[cz * grid.w + cx + 1]?.solid ?? true;
        world.doors.push({
          id: e.id,
          cx,
          cz,
          alongX: westSolid && eastSolid,
          requires: e.requires ?? null,
          open: 0,
          target: 0,
          closeTimer: 0,
          floor: cell.floor,
          height: Math.min(cell.ceil - cell.floor, 2.6),
          mat: e.mat,
        });
        break;
      }
      case 'pickup': {
        const item = data.items[e.item];
        if (!item) throw new Error(`Unknown item '${e.item}'`);
        world.pickups.push({
          id: e.id ?? nextId(e.item),
          item: e.item,
          amount: e.amount ?? item.amount,
          x,
          y: (floorAtWorld(grid, x, z) ?? 0) + e.elevation,
          z,
          respawn: e.respawn ?? null,
          timer: 0,
          active: true,
        });
        break;
      }
      case 'zone': {
        const [w, h] = e.size;
        const x0 = Math.floor(c) * s;
        const z0 = Math.floor(r) * s;
        world.zones.push({ id: e.id, minX: x0, maxX: x0 + w * s, minZ: z0, maxZ: z0 + h * s });
        break;
      }
      case 'guard': {
        if (!world.enemies[e.archetype]) throw new Error(`Unknown enemy archetype '${e.archetype}'`);
        if (e.reserve) world.reserves.push(e);
        else spawnGuard(world, e);
        break;
      }
      case 'light':
        // Lights are read by the renderer (M6).
        break;
    }
  }
  const total = opts.players + (opts.bots ?? 0);
  for (let slot = 0; slot < total; slot++) {
    const p = createPlayer(slot, level.loadout, data);
    p.bot = slot >= opts.players;
    // Levels have starts for two; further players take the spawn farthest from everyone placed so far.
    const sp = world.starts[slot] ?? farthestSpawn(world) ?? world.starts[0] ?? { ...cellCenter(grid, 1, 1), yaw: 0 };
    placePlayer(world, p, sp);
    world.players.push(p);
    world.brains.push(p.bot ? createBrain() : null);
  }
  rebuildBoxes(world);
  return world;
}

function farthestSpawn(world: World): SpawnPoint | null {
  let best: SpawnPoint | null = null;
  let bestD = -1;
  for (const sp of world.spawns) {
    const d = Math.min(Infinity, ...world.players.map((p) => Math.hypot(p.x - sp.x, p.z - sp.z)));
    if (d > bestD) {
      bestD = d;
      best = sp;
    }
  }
  return best;
}

/** Adds a guard from its level entity (also used for reinforcements when the alarm goes off). */
export function spawnGuard(world: World, e: GuardEntity): Guard {
  const g = makeGuard(world, e, world.guards.length);
  world.guards.push(g);
  return g;
}

/** Puts a guard back at its post, fresh and unaware, as in a new level (training dummies). */
export function reviveGuard(world: World, index: number): void {
  const old = world.guards[index];
  const e = world.level.entities.find((x): x is GuardEntity => x.type === 'guard' && x.id === old?.id);
  if (!e) return;
  world.guards[index] = makeGuard(world, e, index);
}

function makeGuard(world: World, e: GuardEntity, index: number): Guard {
  const def = world.enemies[e.archetype]!;
  const s = world.grid.size;
  const [c, r] = e.cell;
  const x = Number.isInteger(c) ? (c + 0.5) * s : c * s;
  const z = Number.isInteger(r) ? (r + 0.5) * s : r * s;
  const yaw = e.yaw * DEG;
  const toPoint = ([pc, pr]: [number, number]) => ({
    x: Number.isInteger(pc) ? (pc + 0.5) * s : pc * s,
    z: Number.isInteger(pr) ? (pr + 0.5) * s : pr * s,
  });
  const gy = floorAtWorld(world.grid, x, z) ?? 0;
  return {
    index,
    id: e.id,
    archetype: e.archetype,
    x,
    y: gy,
    z,
    vx: 0,
    vz: 0,
    vy: 0,
    radius: PLAYER.radius,
    height: PLAYER.height,
    grounded: true,
    yaw,
    aimYaw: yaw,
    aimPitch: 0,
    prev: { x, y: gy, z, yaw },
    hp: def.hp,
    state: 'patrol',
    awareness: 0,
    lastKnown: null,
    targetSlot: null,
    sees: false,
    reaction: 0,
    burstLeft: 0,
    fireCooldown: 0,
    stateTime: 0,
    searchTime: 0,
    flinch: 0,
    lastHurtBy: null,
    deadTime: 0,
    sinceShot: 10,
    patrol: e.patrol.map(toPoint),
    patrolIndex: 0,
    post: { x, z, yaw },
    path: [],
    pathIndex: 0,
    pathGoal: null,
    stuckTime: 0,
    lastProgress: { x, z },
    running: false,
    stepDist: 0,
    uniform: e.uniform ?? def.uniform ?? null,
    look: e.look ?? null,
    cover: null,
    coverPhase: null,
    coverTimer: 0,
    coverCooldown: 0,
    crouching: false,
    alarmTarget: null,
    tiny: 0,
  };
}

/** Door panel geometry: a thin slab across the cell that slides up into the ceiling. */
export function doorBox(world: World, d: Door): Box {
  const s = world.grid.size;
  const x0 = d.cx * s;
  const z0 = d.cz * s;
  const half = 0.12;
  const lift = d.open * d.height;
  return d.alongX
    ? { minX: x0, maxX: x0 + s, minY: d.floor + lift, maxY: d.floor + d.height + lift, minZ: z0 + s / 2 - half, maxZ: z0 + s / 2 + half }
    : { minX: x0 + s / 2 - half, maxX: x0 + s / 2 + half, minY: d.floor + lift, maxY: d.floor + d.height + lift, minZ: z0, maxZ: z0 + s };
}

export function rebuildBoxes(world: World): void {
  const boxes: Box[] = [];
  for (const p of world.props) if (p.alive && p.solid) boxes.push(p.box);
  for (const d of world.doors) if (d.open < 0.95) boxes.push(doorBox(world, d));
  world.terrain = { grid: world.grid, boxes };
}

export function emit(world: World, e: SimEvent): void {
  world.events.push(e);
}
