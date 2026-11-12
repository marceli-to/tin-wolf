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
  /** Wall look. On a solid cell it overrides the look of the room it faces. */
  wall: z.string().optional(),
  /** Look of the step face where this cell is higher than its neighbour (default: wall). */
  step: z.string().optional(),
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
    /** Uniform colour override for the guard's model. */
    uniform: z.string().optional(),
    /** Outfit name (render-only), e.g. 'worker'. */
    look: z.string().optional(),
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
    /** Metres above the floor, for things standing on other things. */
    elevation: z.number().default(0),
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
  /** Weapons players start (and respawn) with; the first is drawn. */
  loadout: z.array(z.string()).min(1).default(['pistol']),
  match: z.object({ killLimit: z.number().int().positive(), timeLimit: z.number().positive() }).optional(),
});
export type LevelDef = z.output<typeof LevelSchema>;

export const WeaponSchema = z.object({
  name: z.string(),
  /** Hitscan fires rays; thrown weapons launch a projectile that explodes after `fuse` seconds. */
  type: z.enum(['hitscan', 'thrown']).default('hitscan'),
  /** Ammo pool the weapon draws from; weapons sharing a pool share reserve rounds. */
  ammo: z.string(),
  damage: z.number().default(0),
  zoneMultiplier: z.object({ head: z.number(), torso: z.number(), limb: z.number() }).default({ head: 1, torso: 1, limb: 1 }),
  fireInterval: z.number().positive(),
  auto: z.boolean().default(false),
  spreadDeg: z.number().min(0).default(0),
  /** Rounds per magazine; thrown weapons have no magazine and use the pool directly. */
  magSize: z.number().int().min(0).default(0),
  /** Reserve rounds given with the weapon (start loadout or first pickup). */
  startReserve: z.number().int().min(0),
  maxReserve: z.number().int().min(0),
  reloadTime: z.number().positive().default(1),
  range: z.number().positive().default(60),
  noiseRadius: z.number().min(0),
  sfx: z.string(),
  /** Thrown: launch speed (m/s), fuse (s), blast radius (m) and damage at the centre. */
  throwSpeed: z.number().default(12),
  fuse: z.number().default(2.2),
  blastRadius: z.number().default(0),
  blastDamage: z.number().default(0),
  /** Model held in hand (render-only). `fit: 'gun'` keeps the gun pack's scale relative to the pistol. */
  model: z.string().optional(),
  fit: z.enum(['gun', 'hand']).default('gun'),
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
  /** Multiplier on weapon damage so guards are less lethal than players. */
  damageScale: z.number().positive().default(1),
  /** Shots per burst, min and max. */
  burst: z.tuple([z.number().int().positive(), z.number().int().positive()]).default([2, 3]),
  color: z.string(),
  legs: z.string().default('#2e2e30'),
  /** Uniform colour for the character model (archetype default). */
  uniform: z.string().optional(),
  /** Item left where the guard falls. */
  drop: z.string().optional(),
  dropAmount: z.number().optional(),
});
export type EnemyDef = z.output<typeof EnemySchema>;
export const EnemiesSchema = z.record(z.string(), EnemySchema);

export const ItemSchema = z.object({
  name: z.string(),
  kind: z.enum(['key', 'health', 'ammo', 'armor', 'weapon']),
  amount: z.number().default(0),
  /** Weapon given by a `weapon` item; `amount` is the ammo that comes with it. */
  weapon: z.string().optional(),
  /** Ammo pool an `ammo` item refills. */
  ammo: z.string().optional(),
  color: z.string(),
  /** Optional model under /assets; keys are tinted with `color`. */
  model: z.string().optional(),
  modelScale: z.number().default(1),
});
export type ItemDef = z.output<typeof ItemSchema>;
export const ItemsSchema = z.record(z.string(), ItemSchema);

export const PropKindSchema = z.object({
  size: z.tuple([z.number(), z.number(), z.number()]),
  mat: z.string(),
  hp: z.number().optional(),
  usable: z.boolean().default(false),
  /** Non-solid props are decoration only: no collision, not hit by shots. */
  solid: z.boolean().default(true),
  /** Optional model file under /assets, used when model art is enabled. */
  model: z.string().optional(),
  modelScale: z.number().default(1),
  /**
   * How the model is sized (render-only): 'scale' uses `modelScale`; 'footprint' scales it uniformly to
   * fill the collision box's floor area; 'stretch' fills the whole collision box (non-uniform).
   */
  modelFit: z.enum(['scale', 'footprint', 'stretch']).default('scale'),
});
export type PropKindDef = z.output<typeof PropKindSchema>;
export const PropKindsSchema = z.record(z.string(), PropKindSchema);
