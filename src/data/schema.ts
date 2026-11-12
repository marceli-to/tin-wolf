import { z } from 'zod';

const Dir = z.enum(['n', 'e', 's', 'w']);
const CellRef = z.tuple([z.number(), z.number()]);

export const CellDefSchema = z.object({
  solid: z.boolean().default(false),
  floor: z.number().default(0),
  /** Ramps: `floor` is the low end, `floorTo` the high end, `ramp` the direction of ascent. */
  ramp: Dir.optional(),
  floorTo: z.number().optional(),
  ceil: z.number().default(3),
  /** Open sky: no ceiling geometry is built; `ceil` still bounds movement and rays. */
  sky: z.boolean().default(false),
  floorMat: z.string().default('concrete'),
  ceilMat: z.string().default('ceiling'),
  wall: z.string().default('concrete'),
  /** 0..1 baked light level for the cell (M6). */
  light: z.number().min(0).max(1).default(0.8),
});
export type CellDef = z.output<typeof CellDefSchema>;

const Base = { id: z.string().optional(), cell: CellRef };

export const EntitySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('playerStart'), slot: z.number().int().min(0), yaw: z.number().default(0), ...Base }),
  z.object({ type: z.literal('spawn'), yaw: z.number().default(0), ...Base }),
  z.object({
    type: z.literal('guard'),
    archetype: z.string(),
    yaw: z.number().default(0),
    patrol: z.array(CellRef).default([]),
    ...Base,
    id: z.string(),
  }),
  z.object({
    type: z.literal('door'),
    requires: z.string().optional(),
    mat: z.string().default('door'),
    ...Base,
    id: z.string(),
  }),
  z.object({
    type: z.literal('pickup'),
    item: z.string(),
    amount: z.number().optional(),
    respawn: z.number().optional(),
    ...Base,
  }),
  z.object({
    type: z.literal('prop'),
    kind: z.string(),
    hp: z.number().optional(),
    size: z.tuple([z.number(), z.number(), z.number()]).optional(),
    yaw: z.number().default(0),
    ...Base,
  }),
  z.object({ type: z.literal('zone'), size: z.tuple([z.number(), z.number()]).default([1, 1]), ...Base, id: z.string() }),
  z.object({ type: z.literal('light'), level: z.number().min(0).max(1), radius: z.number().default(3), ...Base }),
]);
export type EntityDef = z.output<typeof EntitySchema>;

export const ObjectiveSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(['collect', 'destroy', 'reach', 'interact']),
  target: z.string(),
  requires: z.array(z.string()).default([]),
});
export type ObjectiveDef = z.output<typeof ObjectiveSchema>;

export const LevelSchema = z.object({
  id: z.string(),
  name: z.string(),
  mode: z.enum(['mission', 'versus', 'test']).default('test'),
  cellSize: z.number().positive().default(2),
  fog: z.object({ color: z.string().default('#20242a'), near: z.number().default(8), far: z.number().default(40) }).default({
    color: '#20242a',
    near: 8,
    far: 40,
  }),
  legend: z.record(z.string().length(1), CellDefSchema),
  map: z.array(z.string()).min(1),
  entities: z.array(EntitySchema).default([]),
  objectives: z.array(ObjectiveSchema).default([]),
  briefing: z.string().default(''),
  match: z.object({ killLimit: z.number().int().positive(), timeLimit: z.number().positive() }).optional(),
});
export type LevelDef = z.output<typeof LevelSchema>;

export const WeaponSchema = z.object({
  name: z.string(),
  type: z.literal('hitscan'),
  damage: z.number(),
  zoneMultiplier: z.object({ head: z.number(), torso: z.number(), limb: z.number() }),
  fireInterval: z.number().positive(),
  auto: z.boolean(),
  spreadDeg: z.number().min(0),
  magSize: z.number().int().positive(),
  startReserve: z.number().int().min(0),
  maxReserve: z.number().int().min(0),
  reloadTime: z.number().positive(),
  range: z.number().positive(),
  noiseRadius: z.number().min(0),
  sfx: z.string(),
});
export type WeaponDef = z.output<typeof WeaponSchema>;
export const WeaponsSchema = z.record(z.string(), WeaponSchema);

export const EnemySchema = z.object({
  name: z.string(),
  hp: z.number().positive(),
  weapon: z.string(),
  walkSpeed: z.number().positive(),
  runSpeed: z.number().positive(),
  visionRange: z.number().positive(),
  visionFovDeg: z.number().positive(),
  /** Seconds of continuous sight needed to go from suspicious to attack at point-blank range. */
  noticeTime: z.number().positive(),
  hearingScale: z.number().min(0),
  reactionTime: z.number().min(0),
  aimSpreadDeg: z.number().min(0),
  burstPause: z.tuple([z.number(), z.number()]),
  searchTime: z.number().positive(),
  color: z.string(),
});
export type EnemyDef = z.output<typeof EnemySchema>;
export const EnemiesSchema = z.record(z.string(), EnemySchema);

export const ItemSchema = z.object({
  name: z.string(),
  kind: z.enum(['key', 'health', 'ammo', 'armor']),
  amount: z.number().default(0),
  color: z.string(),
});
export type ItemDef = z.output<typeof ItemSchema>;
export const ItemsSchema = z.record(z.string(), ItemSchema);

export const PropKindSchema = z.object({
  size: z.tuple([z.number(), z.number(), z.number()]),
  mat: z.string(),
  hp: z.number().optional(),
  usable: z.boolean().default(false),
});
export type PropKindDef = z.output<typeof PropKindSchema>;
export const PropKindsSchema = z.record(z.string(), PropKindSchema);
