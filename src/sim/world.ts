import { PLAYER } from '../config';
import { createRng, type Rng } from '../core/rng';
import { DEG } from '../core/math';
import type { GameData } from '../data';
import type { LevelDef } from '../data/schema';
import type { Box, Terrain } from './collision';
import type { ActorRef, SimEvent } from './events';
import { buildGrid, cellCenter, floorAtWorld, type Grid } from './grid';

export interface WeaponState {
  id: string;
  mag: number;
  reserve: number;
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
  weapon: WeaponState;
  inventory: string[];
  firePrev: boolean;
  interactPrev: boolean;
  reloadPrev: boolean;
  /** Seconds since the last shot, for recoil animation. */
  sinceShot: number;
  stepDist: number;
  kills: number;
  deaths: number;
  shotsFired: number;
  shotsHit: number;
}

export type GuardState = 'patrol' | 'suspicious' | 'attack' | 'search' | 'dead';

/** Guard state. Behaviour lives in sim/ai (M4); combat only touches hp, flinch and lastHurtBy. */
export interface Guard {
  index: number;
  id: string;
  archetype: string;
  x: number;
  y: number;
  z: number;
  vy: number;
  radius: number;
  height: number;
  grounded: boolean;
  yaw: number;
  prev: { x: number; y: number; z: number; yaw: number };
  hp: number;
  state: GuardState;
  flinch: number;
  lastHurtBy: ActorRef | null;
  deadTime: number;
}

export interface Prop {
  id: string;
  kind: string;
  box: Box;
  hp: number;
  maxHp: number;
  destructible: boolean;
  usable: boolean;
  used: boolean;
  alive: boolean;
  mat: string;
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
}

export interface World {
  level: LevelDef;
  data: GameData;
  grid: Grid;
  tick: number;
  time: number;
  rng: Rng;
  players: Player[];
  guards: Guard[];
  props: Prop[];
  doors: Door[];
  pickups: Pickup[];
  zones: Zone[];
  spawns: SpawnPoint[];
  starts: SpawnPoint[];
  events: SimEvent[];
  /** Collision obstacles, rebuilt each tick from props and doors. */
  terrain: Terrain;
}

export interface WorldOptions {
  players: number;
  seed?: number;
}

export function createPlayer(slot: number, weaponId: string, data: GameData): Player {
  const w = data.weapons[weaponId];
  if (!w) throw new Error(`Unknown weapon '${weaponId}'`);
  return {
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
    weapon: { id: weaponId, mag: w.magSize, reserve: w.startReserve, cooldown: 0, reloadTimer: 0 },
    inventory: [],
    firePrev: false,
    interactPrev: false,
    reloadPrev: false,
    sinceShot: 10,
    stepDist: 0,
    kills: 0,
    deaths: 0,
    shotsFired: 0,
    shotsHit: 0,
  };
}

export function placePlayer(world: World, p: Player, sp: SpawnPoint): void {
  p.x = sp.x;
  p.z = sp.z;
  p.y = floorAtWorld(world.grid, sp.x, sp.z) ?? 0;
  p.prev = { x: p.x, y: p.y, z: p.z, crouch: 0 };
  p.yaw = sp.yaw;
  p.pitch = 0;
  p.vx = p.vz = p.vy = 0;
  p.grounded = true;
  p.crouch = 0;
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
    players: [],
    guards: [],
    props: [],
    doors: [],
    pickups: [],
    zones: [],
    spawns: [],
    starts: [],
    events: [],
    terrain: { grid, boxes: [] },
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
        world.starts[e.slot] = { x, z, yaw: e.yaw * DEG };
        break;
      case 'spawn':
        world.spawns.push({ x, z, yaw: e.yaw * DEG });
        break;
      case 'prop': {
        const kind = data.props[e.kind];
        if (!kind) throw new Error(`Unknown prop kind '${e.kind}'`);
        const [sx, sy, sz] = e.size ?? kind.size;
        const rot = Math.round(e.yaw / 90) % 2 !== 0;
        const hx = (rot ? sz : sx) / 2;
        const hz = (rot ? sx : sz) / 2;
        const fy = floorAtWorld(grid, x, z) ?? 0;
        const hp = e.hp ?? kind.hp ?? 0;
        world.props.push({
          id: e.id ?? nextId(e.kind),
          kind: e.kind,
          box: { minX: x - hx, maxX: x + hx, minY: fy, maxY: fy + sy, minZ: z - hz, maxZ: z + hz },
          hp,
          maxHp: hp,
          destructible: hp > 0,
          usable: kind.usable,
          used: false,
          alive: true,
          mat: kind.mat,
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
          y: floorAtWorld(grid, x, z) ?? 0,
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
      case 'guard':
      case 'light':
        // Guards arrive in M4; lights are read by the renderer.
        break;
    }
  }
  for (let slot = 0; slot < opts.players; slot++) {
    const p = createPlayer(slot, 'pistol', data);
    const sp = world.starts[slot] ?? world.spawns[slot] ?? world.starts[0] ?? { ...cellCenter(grid, 1, 1), yaw: 0 };
    placePlayer(world, p, sp);
    world.players.push(p);
  }
  rebuildBoxes(world);
  return world;
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
  for (const p of world.props) if (p.alive) boxes.push(p.box);
  for (const d of world.doors) if (d.open < 0.95) boxes.push(doorBox(world, d));
  world.terrain = { grid: world.grid, boxes };
}

export function emit(world: World, e: SimEvent): void {
  world.events.push(e);
}
