import * as THREE from 'three';
import type { ModelInstance } from './models';
import { measureHeight, tintModel } from './models';
import { flatMaterial, shadedBox } from './shapes';
import type { BodyShape } from '../sim/hitbox';
import { POWERUP_SCALE } from './pickups';

/** Game-side animation names; each art set maps them to its own clip names. */
export type CharacterAnim = 'idle' | 'alert' | 'walk' | 'run' | 'aim' | 'shoot' | 'die' | 'crouch' | 'crouchShoot';
/** Animations every art set names a clip for; `crouchShoot` is built from `crouch` plus the shoot arms. */
type BaseAnim = Exclude<CharacterAnim, 'crouchShoot'>;

export interface CharacterProfile {
  model: string;
  /** Body proportions: the sim's hit zones and standing height follow the figure. */
  body: BodyShape;
  clips: Record<BaseAnim, string>;
  /** Bone the gun is parented to. */
  hand: string;
  /**
   * Ground speed (m/s) of the planted foot in `walk` and `run` at 1×; playback is scaled by the actor's
   * speed over it so the feet don't slide. Default 1.6 / 5 (Kenney).
   */
  groundSpeed?: { walk: number; run: number };
  /** Placement of the fallback box gun when no gun model is given. */
  boxGun?: { position: [number, number, number] };
  /** Meshes in the model file to hide (e.g. a prop it ships with). */
  hide?: string[];
  /** Where held guns go in the hand bone (model units). */
  grip?: GripSpec;
  /**
   * Arm pose layered over every animation but death: tracks of `bones` come from `clip` (and from
   * `shootClip` while shooting), so a figure walks and runs with its gun raised.
   */
  armed?: ArmedPose & {
    /** Pose for two-handed weapons (`hold: 'two'`), with its own grip if the hand turns. */
    two?: ArmedPose & { grip?: GripSpec };
  };
}

/** How the arms hold a weapon, layered over the base animations. */
export interface ArmedPose {
  clip: string;
  shootClip: string;
  bones: string[];
  /** Arm clips keyed for the crouch's leaning chest (same bones); without them the standing ones are used. */
  crouch?: { clip: string; shootClip: string };
}

export type HoldStyle = 'one' | 'two';

/**
 * Guns from the game-pack-generator carry a `grip` node (where the fist closes) and a `muzzle` node, in metres,
 * with +X along the barrel and +Y up: the frame of the Tin Fox figures' `handslot.r` while aiming.
 */
export const GUN_GRIP_NODE = 'grip';
export const GUN_MUZZLE_NODE = 'muzzle';
/** Metres per Kenney Blaster Kit unit at the Tin Fox figures' scale (`T_GRIP.scale`). */
const KENNEY_UNIT_M = 0.65;

export interface GripSpec {
  /**
   * The hand bone is in the generator's gun frame (metres, +X barrel, +Y up): guns with a `grip` node go in
   * as they are. Without it, such guns are turned into Kenney-pack axes and units and placed like a blaster.
   */
  native?: boolean;
  /** Hand point in the hand bone's space, where the gun's grip goes (model units). */
  position: [number, number, number];
  /** Gun-pack axes to hand-bone axes (radians, XYZ order). */
  rotation: [number, number, number];
  /** Model units per gun-pack unit, applied to every gun so their relative sizes stay. */
  scale: number;
}

/**
 * Puts a gun model in a hand that has no gun of its own: the gun's grip (the centre of its lowest
 * vertices) goes to the grip point, rotated into hand axes. Returns the holder added to `hand`.
 */
export function attachHeldGun(hand: THREE.Object3D, gun: THREE.Object3D, grip: GripSpec, relSize?: number): THREE.Object3D {
  // A `grip` node wins over the palm fit: a generator grenade brings its own spot beside the ball.
  const gripNode = gun.getObjectByName(GUN_GRIP_NODE);
  if (gripNode) {
    const holder = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(gun);
    gun.updateMatrixWorld(true);
    // The grip point goes to the holder's origin.
    const at = gripNode.getWorldPosition(new THREE.Vector3());
    gun.worldToLocal(at);
    gun.position.copy(at).multiplyScalar(-1);
    holder.add(inner);
    if (!grip.native) {
      // Gun frame (+X barrel) to Kenney-pack axes (-Z barrel), metres to Kenney units, then the blaster grip.
      inner.rotation.y = Math.PI / 2;
      inner.scale.setScalar(1 / KENNEY_UNIT_M);
      holder.position.set(...grip.position);
      holder.rotation.set(...grip.rotation);
      holder.scale.setScalar(grip.scale);
    }
    hand.add(holder);
    return holder;
  }
  gun.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gun);
  const g = new THREE.Vector3();
  const v = new THREE.Vector3();
  let n = 0;
  const lowY = box.min.y + (box.max.y - box.min.y) * 0.25;
  gun.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (v.y <= lowY) {
        g.add(v);
        n++;
      }
    }
  });
  if (n) g.divideScalar(n);
  else box.getCenter(g);
  const holder = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(gun);
  // A thrown weapon sits in the palm, centred.
  if (relSize) box.getCenter(g);
  gun.position.sub(g);
  holder.add(inner);
  holder.position.set(...grip.position);
  holder.rotation.set(...grip.rotation);
  holder.scale.setScalar(grip.scale * (relSize ?? 1));
  hand.add(holder);
  return holder;
}

/**
 * Animation clips per game animation. With an `armed` pose the arm tracks of every clip but death
 * are replaced by the armed clip's, so legs walk while the arms keep the gun up.
 */
export function buildClips(animations: THREE.AnimationClip[], profile: CharacterProfile, style: HoldStyle = 'one'): Map<CharacterAnim, THREE.AnimationClip> {
  const byName = new Map(animations.map((c) => [c.name, c]));
  const out = new Map<CharacterAnim, THREE.AnimationClip>();
  const armed = style === 'two' && profile.armed?.two ? profile.armed.two : profile.armed;
  const isArm = (t: THREE.KeyframeTrack): boolean => !!armed && armed.bones.some((b) => t.name.startsWith(`${THREE.PropertyBinding.sanitizeNodeName(b)}.`));
  const entries = [...(Object.entries(profile.clips) as [CharacterAnim, string][]), ['crouchShoot', profile.clips.crouch] as [CharacterAnim, string]];
  for (const [anim, name] of entries) {
    const base = byName.get(name);
    if (!base) continue;
    const crouched = anim === 'crouch' || anim === 'crouchShoot';
    const arms = crouched && armed?.crouch ? armed.crouch : armed;
    const shooting = anim === 'shoot' || anim === 'crouchShoot';
    const pose = arms && anim !== 'die' ? byName.get(shooting ? arms.shootClip : arms.clip) : null;
    // Without an arm layer a crouching shot is just the crouch.
    if (anim === 'crouchShoot' && !pose) continue;
    if (!pose) {
      out.set(anim, base);
      continue;
    }
    const tracks = [...base.tracks.filter((t) => !isArm(t)), ...pose.tracks.filter(isArm)];
    out.set(anim, new THREE.AnimationClip(`${anim}+${style}`, base.duration, tracks));
  }
  return out;
}

/**
 * Barrel tip of the gun a character carries, in the hand bone's local space: the gun-mesh vertex
 * farthest from the hand, measured in the current (skinned) pose. Returns null if the model has no such mesh.
 */
export function findMuzzle(root: THREE.Object3D, hand: THREE.Object3D, gunNode = 'Pistol'): THREE.Vector3 | null {
  const node = root.getObjectByName(gunNode);
  if (!node) return null;
  // A multi-material gun is a group of meshes; check every vertex of every one.
  const meshes: THREE.Mesh[] = [];
  node.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  if (!meshes.length) return null;
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let best: THREE.Vector3 | null = null;
  let bestD = -1;
  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute('position');
    const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh ? (mesh as THREE.SkinnedMesh) : null;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (skinned) skinned.applyBoneTransform(i, v);
      mesh.localToWorld(v);
      hand.worldToLocal(v);
      const d = v.lengthSq();
      if (d > bestD) {
        bestD = d;
        best = v.clone();
      }
    }
  }
  return best;
}

/** Barrel tip of an arbitrary (non-skinned) gun object, in hand space. */
export function findMuzzleIn(gun: THREE.Object3D, hand: THREE.Object3D): THREE.Vector3 | null {
  const node = gun.getObjectByName(GUN_MUZZLE_NODE);
  if (node) {
    gun.updateMatrixWorld(true);
    return hand.worldToLocal(node.getWorldPosition(new THREE.Vector3()));
  }
  const named = gun.name || 'heldGun';
  gun.name = named;
  return findMuzzle(gun.parent ?? gun, hand, named);
}

/** One held weapon per weapon id, all placed in the hand; only the drawn one is visible. */
export interface HeldGun {
  id: string;
  model: ModelInstance;
  fit: 'gun' | 'hand';
  /** One- or two-handed pose (characters with an `armed.two` pose). */
  hold?: HoldStyle;
}

/** Three's glTF loader strips characters such as '.' from node names ('Wrist.R' becomes 'WristR'). */
export function findNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  const o = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name)) ?? root.getObjectByName(name);
  if (!o) console.warn(`Model node '${name}' not found`);
  return o ?? null;
}

export interface ArtSet {
  guard: CharacterProfile;
  officer: CharacterProfile;
  /** Weapon models of this set by weapon id, instead of `weapons.json`'s `model` (held, and thrown in flight). */
  weapons?: Record<string, string>;
  /** Pickup models of this set by item id, instead of `items.json`'s `model` / `modelScale`. */
  items?: Record<string, { model: string; scale: number }>;
  /** Prop models of this set by prop id, instead of `props.json`'s `model` / `modelFit` / `modelScale`. */
  props?: Record<string, { model: string; fit?: 'scale' | 'footprint' | 'stretch'; scale?: number; size?: [number, number, number]; grow?: number;
    /** Material name → flat colour, replacing that material's texture (a green button on a red-button model). */
    recolor?: Record<string, string>;
  }>;
  /** Training-target model with `hinge` / `board` nodes (board radius `TARGET_MODEL_RADIUS`), instead of the built one. */
  target?: string;
  /** Figure per guard archetype, ahead of `guard` / `officer` (e.g. a rifle guard of its own). */
  archetypes?: Record<string, CharacterProfile>;
  /** Alternative outfits a guard can wear via `look` (same rig and animations). */
  looks?: Record<string, CharacterProfile>;
  /** Player bodies (seen by the other player in split-screen). */
  player?: CharacterProfile;
  /** Player body per slot, instead of tinting one shared model. */
  playerModels?: string[];
  /** Level surface style ('flat': clean, no grime, rivets or noise, to match the models; 'tinfox': own palette). */
  textures?: 'flat' | 'tinfox';
  /** Brighter mood: baked light is lifted toward `lightFloor`, fog lightened toward `fogTint` and pushed back. */
  mood?: { lightFloor: number; fogTint: string; fogMix: number; fogFarScale: number };
  /** First-person arms: the player model in an aiming pose, head collapsed, placed at the camera. */
  viewArms?: {
    model: string;
    clip: string;
    /** Arm pose for two-handed weapons in first person. */
    twoClip?: string;
    /** Bones scaled to zero so they never block the view. */
    collapse: string[];
    /** Where the model's head bone sits relative to the camera (metres; x right, y up, z back). */
    headOffset: [number, number, number];
    hand: string;
    muzzle: [number, number, number];
    /** Head bone placed at `headOffset` (default 'Head'). */
    headBone?: string;
    grip?: GripSpec;
    /** First person shows the gun alone, without the figure's hand. */
    gunOnly?: boolean;
  };
}

export const PROFILES: Record<string, ArtSet> = {};

// Kenney Mini Characters: blocky rigid parts (root, legs, torso, arms, head), no gun of their own.
// In bind pose the right arm points along the bone's -x with the fist at its end.
const K_GRIP: GripSpec = { position: [-0.27, 0.0, 0.02], rotation: [0, Math.PI / 2 + 0.5, 0], scale: 0.4 };
const K_CLIPS: CharacterProfile["clips"] = {
  idle: 'idle',
  alert: 'holding-right',
  walk: 'walk',
  run: 'sprint',
  aim: 'holding-right',
  shoot: 'holding-right-shoot',
  die: 'die',
  crouch: 'crouch',
};
const kenneyChar = (file: string): CharacterProfile => ({
  model: `kenney/characters/${file}.glb`,
  body: 'chibi',
  clips: K_CLIPS,
  hand: 'arm-right',
  grip: K_GRIP,
  armed: {
    clip: 'holding-right',
    shootClip: 'holding-right-shoot',
    bones: ['arm-right'],
    two: { clip: 'holding-both', shootClip: 'holding-both-shoot', bones: ['arm-left', 'arm-right'] },
  },
});

PROFILES.kenney = {
  guard: kenneyChar('character-male-c'),
  officer: kenneyChar('character-male-d'),
  looks: { worker: kenneyChar('character-worker') },
  player: kenneyChar('character-soldier'),
  playerModels: ['kenney/characters/character-soldier.glb', 'kenney/characters/character-female-b.glb'],
  viewArms: {
    model: 'kenney/characters/character-soldier.glb',
    clip: 'holding-right',
    twoClip: 'holding-both',
    collapse: ['head', 'leg-left', 'leg-right', 'arm-left'],
    headBone: 'head',
    hand: 'arm-right',
    muzzle: [0, 0, 0],
    headOffset: [-0.3, -0.31, 0.04],
    // Smaller than in third person: up close the toy blasters filled a quarter of the screen.
    grip: { ...K_GRIP, position: [-0.29, 0.03, 0.02], scale: 0.26 },
    gunOnly: true,
  },
  textures: 'flat',
  // Toy look: no pitch-dark corners and a light, distant haze instead of gloom.
  mood: { lightFloor: 0.5, fogTint: '#c4d8e8', fogMix: 0.45, fogFarScale: 1.5 },
};

// Tin Fox's own figures from the game-pack-generator (KayKit Rig_Medium, metres, faces +z).
// Guard, rifle guard and officer so far; everything else stays Kenney. The aim clips key only the arms they
// use, so they layer over walk and run: one-handed the right arm (the left hangs and swings with the
// base clip), two-handed both (and move the upper-arm heads forward, for the missing collarbone).
const T_RIGHT = ['upperarm.r', 'lowerarm.r', 'wrist.r', 'hand.r', 'handslot.r'];
const T_BOTH = [...T_RIGHT, 'upperarm.l', 'lowerarm.l', 'wrist.l', 'hand.l', 'handslot.l'];
const T_GRIP: GripSpec = { native: true, position: [0, -0.02, 0], rotation: [0, -Math.PI / 2, 0], scale: 0.65 };
const tinfoxChar = (file: string): CharacterProfile => ({
  model: `tinfox/characters/${file}.glb`,
  body: 'tinfox',
  clips: { idle: 'idle', alert: 'idle', walk: 'walk', run: 'run', aim: 'idle', shoot: 'idle', die: 'die', crouch: 'crouch' },
  hand: 'handslot.r',
  // walk and run are planted for these speeds (generator, guard update 3).
  groundSpeed: { walk: 1.6, run: 4 },
  grip: T_GRIP,
  armed: {
    clip: 'aim_1h',
    shootClip: 'shoot_1h',
    bones: T_RIGHT,
    crouch: { clip: 'crouch_aim_1h', shootClip: 'crouch_shoot_1h' },
    two: { clip: 'aim_2h', shootClip: 'shoot_2h', bones: T_BOTH, crouch: { clip: 'crouch_aim_2h', shootClip: 'crouch_shoot_2h' } },
  },
});

/** Furniture grows with the Tin Fox figures (1.9 m, chunky): model and collider together, the centre stays. */
const FURNITURE_GROW = 1.2;

PROFILES.tinfox = {
  ...PROFILES.kenney,
  textures: 'tinfox',
  guard: tinfoxChar('guard'),
  archetypes: { guard_rifle: tinfoxChar('rifle-guard'), guard_officer: tinfoxChar('officer') },
  // Generator weapons (guns with `grip` / `muzzle` nodes, the grenade with `grip`), in metres.
  weapons: {
    pistol: 'tinfox/weapons/pistol.glb',
    pistol_sd: 'tinfox/weapons/pistol-sd.glb',
    smg: 'tinfox/weapons/smg.glb',
    sniper: 'tinfox/weapons/sniper.glb',
    grenade: 'tinfox/weapons/grenade.glb',
  },
  // Pickups spin and bob above the floor, so they keep about the size the Kenney ones had there.
  items: {
    weapon_pistol_sd: { model: 'tinfox/weapons/pistol-sd.glb', scale: 0.8 },
    weapon_smg: { model: 'tinfox/weapons/smg.glb', scale: 0.9 },
    weapon_sniper: { model: 'tinfox/weapons/sniper.glb', scale: 0.75 },
    grenades: { model: 'tinfox/weapons/grenade.glb', scale: 2 },
    ammo_pistol: { model: 'tinfox/weapons/ammo-pistol.glb', scale: 1.6 },
    ammo_rifle: { model: 'tinfox/weapons/ammo-pistol.glb', scale: 1.6 },
    ammo_smg: { model: 'tinfox/weapons/ammo-smg.glb', scale: 1.6 },
    // Pickups and keycards built to the sizes of the code-built ones (scale 1); keycards in their colours.
    medkit: { model: 'tinfox/props/medkit.glb', scale: 1 },
    armor: { model: 'tinfox/props/vest.glb', scale: 1 },
    key_red: { model: 'tinfox/props/keycard-red.glb', scale: 1 },
    key_blue: { model: 'tinfox/props/keycard-blue.glb', scale: 1 },
    // Power-ups are built about 0.40 m high and drawn 1.4x, like the code-built ones, over their ring.
    power_speed: { model: 'tinfox/props/power-speed.glb', scale: POWERUP_SCALE },
    power_shield: { model: 'tinfox/props/power-shield.glb', scale: POWERUP_SCALE },
    power_damage: { model: 'tinfox/props/power-damage.glb', scale: POWERUP_SCALE },
    power_jump: { model: 'tinfox/props/power-jump.glb', scale: POWERUP_SCALE },
    power_refill: { model: 'tinfox/props/power-refill.glb', scale: POWERUP_SCALE },
    power_shrink: { model: 'tinfox/props/power-shrink.glb', scale: POWERUP_SCALE },
  },
  // Generator props: metres, front +Z, origin on the floor. The barrel is round (0.55 m) and keeps its
  // size inside the slightly larger collider; the ammo crate is turned in its file to run along Z.
  props: {
    // Round, 0.55 m across: the collider follows the model instead of Kenney's 0.72 x 0.62.
    barrel_red: { model: 'tinfox/props/barrel.glb', fit: 'scale', scale: 1, size: [0.56, 0.9, 0.56] },
    surprise_box: { model: 'tinfox/props/surprise-box.glb', fit: 'scale', scale: 1 },
    ammo_crate: { model: 'tinfox/props/ammo-crate.glb', fit: 'footprint' },
    // Generic cover, built to the data boxes exactly. The storage barrel is round (0.65 m) and is
    // stretched to Kenney's 0.68 x 0.62 box (about 5 %), so the colliders and the levels stay as they are.
    crate: { model: 'tinfox/props/crate.glb', fit: 'scale', scale: 1 },
    crate_tall: { model: 'tinfox/props/crate-tall.glb', fit: 'scale', scale: 1 },
    cargo: { model: 'tinfox/props/cargo.glb', fit: 'scale', scale: 1 },
    barrel: { model: 'tinfox/props/storage-barrel.glb', fit: 'stretch' },
    // Depot core, built to the data boxes. The desk is built at lab_desk_small's 1.65 x 0.82 and stretches
    // to the long lab desk (2.27) and the office desk (1.49 x 0.70): only the knee space, top and panel grow.
    // The bunk bed stands its full 1.65 m over its 0.75 m collider.
    locker: { model: 'tinfox/props/locker.glb', fit: 'scale', scale: 1, grow: FURNITURE_GROW },
    lab_desk_small: { model: 'tinfox/props/desk.glb', fit: 'scale', scale: 1, grow: FURNITURE_GROW },
    lab_desk: { model: 'tinfox/props/desk.glb', fit: 'stretch', grow: FURNITURE_GROW },
    desk: { model: 'tinfox/props/desk.glb', fit: 'stretch', grow: FURNITURE_GROW },
    terminal: { model: 'tinfox/props/terminal.glb', fit: 'scale', scale: 1, grow: FURNITURE_GROW },
    bunk_bed: { model: 'tinfox/props/bunk-bed.glb', fit: 'scale', scale: 1, grow: FURNITURE_GROW },
    // The mission target (destroyed: hidden like any prop), built to its 1.40 x 1.20 x 0.70 box.
    console: { model: 'tinfox/props/console.glb', fit: 'scale', scale: 1, grow: FURNITURE_GROW },
    // The rest of the depot kit, built to the data boxes. The cabinet also stands in, squeezed, for the
    // 1.10 m bookcase. The mess table's top is at 0.63 m (a mug on it reaches the box's 0.74), so its
    // collider stops at the table top: you stand on the table, not on air above it.
    shelf_wide: { model: 'tinfox/props/storage-cabinet.glb', fit: 'scale', scale: 1, grow: FURNITURE_GROW },
    bookcase: { model: 'tinfox/props/storage-cabinet.glb', fit: 'stretch', grow: FURNITURE_GROW },
    shelf: { model: 'tinfox/props/supply-shelf.glb', fit: 'scale', scale: 1, grow: FURNITURE_GROW },
    office_chair: { model: 'tinfox/props/office-chair.glb', fit: 'scale', scale: 1, grow: FURNITURE_GROW },
    chair: { model: 'tinfox/props/chair.glb', fit: 'scale', scale: 1, grow: FURNITURE_GROW },
    mess_table: { model: 'tinfox/props/mess-table.glb', fit: 'scale', scale: 1, size: [1.28, 0.63, 2.5], grow: FURNITURE_GROW },
    armchair: { model: 'tinfox/props/armchair.glb', fit: 'scale', scale: 1, grow: FURNITURE_GROW },
    side_table: { model: 'tinfox/props/drawer-cabinet.glb', fit: 'scale', scale: 1, grow: FURNITURE_GROW },
    // The last two depot props: the chest grows with the furniture; the yard's dish keeps its 4.34 m.
    chest: { model: 'tinfox/props/chest.glb', fit: 'scale', scale: 1, grow: FURNITURE_GROW },
    satellite_dish: { model: 'tinfox/props/satellite-dish.glb', fit: 'scale', scale: 1 },
    // Wall panels, built to the 0.50 x 0.70 x 0.16 box. The alarm's lamp (M_Lamp) flashes when the alarm
    // is raised; the training start panel is the same model with a green button.
    alarm_panel: { model: 'tinfox/props/alarm-panel.glb', fit: 'scale', scale: 1 },
    start_panel: { model: 'tinfox/props/alarm-panel.glb', fit: 'scale', scale: 1, recolor: { M_Button: '#3fae4a' } },
  },
  target: 'tinfox/props/target.glb',
};

/** The figure an art set gives a guard: its look's outfit, the officer, or the plain guard. */
export function guardProfile(set: ArtSet, archetype: string, look?: string | null): CharacterProfile {
  return (look && set.looks?.[look]) || set.archetypes?.[archetype] || (archetype === 'guard_officer' ? set.officer : set.guard);
}

/** Body proportions for the sim: players and every guard archetype and look, from the art set's figures. */
export function artBodies(art: string, archetypes: readonly string[]): { body: BodyShape; guardBodies: Record<string, BodyShape> } {
  const set = PROFILES[art];
  if (!set) return { body: 'human', guardBodies: {} };
  const guardBodies: Record<string, BodyShape> = {};
  for (const a of archetypes) guardBodies[a] = guardProfile(set, a).body;
  for (const [look, p] of Object.entries(set.looks ?? {})) guardBodies[`look:${look}`] = p.body;
  return { body: (set.player ?? set.guard).body, guardBodies };
}

/** Collision sizes the art set's own prop models ask for (the sim's boxes follow the model). */
export function artPropSizes(art: string, dataSizes: Record<string, { size: [number, number, number] }>): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {};
  for (const [kind, p] of Object.entries(PROFILES[art]?.props ?? {})) {
    const base = p.size ?? dataSizes[kind]?.size;
    if (!base || (!p.size && !p.grow)) continue;
    const g = p.grow ?? 1;
    out[kind] = [base[0] * g, base[1] * g, base[2] * g];
  }
  return out;
}


export function profileModels(art: string): string[] {
  const set = PROFILES[art];
  if (!set) return [];
  const profiles = [set.guard, set.officer, ...(set.player ? [set.player] : []), ...Object.values(set.archetypes ?? {}), ...Object.values(set.looks ?? {})];
  return [
    ...profiles.map((p) => p.model),
    ...(set.viewArms ? [set.viewArms.model] : []),
    ...(set.playerModels ?? []),
    ...Object.values(set.weapons ?? {}),
    ...Object.values(set.items ?? {}).map((i) => i.model),
    ...Object.values(set.props ?? {}).map((p) => p.model),
    ...(set.target ? [set.target] : []),
  ];
}

const FADE = 0.18;

/** Animated glTF character driven by sim state. Faces -z like the box humanoid. */
export class ModelCharacter {
  readonly root = new THREE.Group();
  readonly flash: THREE.Object3D;
  /** The hand-held gun, exposed for placement tuning. */
  readonly gun: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<CharacterAnim, THREE.AnimationAction>();
  /** Actions per hold style; `actions` is the set of the drawn weapon. */
  private styles = new Map<HoldStyle, Map<CharacterAnim, THREE.AnimationAction>>();
  private style: HoldStyle = 'one';
  private current: CharacterAnim | null = null;
  private materials: THREE.MeshStandardMaterial[];
  /** Held weapons by id, with the barrel tip in hand space (null for thrown weapons). */
  private held = new Map<string, { holder: THREE.Object3D; tip: THREE.Vector3 | null; style: HoldStyle }>();
  private weaponId = '';
  private inner: THREE.Object3D;
  private groundSpeed: { walk: number; run: number };
  private height: number;

  /**
   * `held` lists the weapons this character can draw (one for guards, every weapon for players).
   */
  constructor(
    model: ModelInstance,
    profile: CharacterProfile,
    height: number,
    flashMaterial: THREE.Material,
    held: HeldGun[] = [],
  ) {
    const inner = model.object;
    this.inner = inner;
    this.height = height;
    this.groundSpeed = profile.groundSpeed ?? { walk: 1.6, run: 5 };
    for (const name of profile.hide ?? []) {
      const o = findNode(inner, name);
      if (o) o.visible = false;
    }
    const h = measureHeight(inner) || 1;
    inner.scale.setScalar(height / h);
    // glTF characters face +z; the game's figures face -z.
    inner.rotation.y = Math.PI;
    this.root.add(inner);
    this.materials = [...model.materials, ...held.flatMap((h) => h.model.materials)];
    this.mixer = new THREE.AnimationMixer(inner);
    for (const style of profile.armed?.two ? (['one', 'two'] as const) : (['one'] as const)) {
      const set = new Map<CharacterAnim, THREE.AnimationAction>();
      for (const [anim, clip] of buildClips(model.animations, profile, style)) set.set(anim, this.mixer.clipAction(clip));
      const die = set.get('die');
      if (die) {
        die.setLoop(THREE.LoopOnce, 1);
        die.clampWhenFinished = true;
      }
      this.styles.set(style, set);
    }
    this.actions = this.styles.get('one')!;
    const hand = findNode(inner, profile.hand) ?? inner;
    // Undo the character's scale so gun offsets are in metres.
    const holder = new THREE.Group();
    holder.scale.setScalar(1 / inner.scale.x);
    hand.add(holder);
    if (profile.grip) {
      // Held guns go into the grip below.
      this.gun = holder;
    } else {
      const box = new THREE.Mesh(shadedBox(0.07, 0.12, 0.28), flatMaterial('#232428'));
      box.position.set(...(profile.boxGun?.position ?? [0, 0, 0]));
      holder.add(box);
      this.gun = box;
    }
    const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), flashMaterial);
    flash.visible = false;
    if (profile.grip) {
      // Guns go into the empty hand; the flash sits on each barrel tip in hand space, measured in
      // the aiming pose of the weapon's hold style.
      for (const h of held) {
        const style: HoldStyle = h.hold === 'two' && this.styles.has('two') ? 'two' : 'one';
        const grip = (style === 'two' ? profile.armed?.two?.grip : undefined) ?? profile.grip;
        const aim = this.styles.get(style)!.get('aim');
        aim?.play();
        this.mixer.update(0.3);
        inner.updateMatrixWorld(true);
        const holder = attachHeldGun(hand, h.model.object, grip, h.fit === 'hand' ? 0.45 : undefined);
        const tip = h.fit === 'hand' ? null : findMuzzleIn(holder, hand);
        aim?.stop();
        holder.visible = false;
        this.held.set(h.id, { holder, tip, style });
      }
      flash.scale.setScalar(1 / inner.scale.x);
      hand.add(flash);
    } else {
      flash.position.set(0, 0, 0.25);
      holder.add(flash);
    }
    this.flash = flash;
    const first = held[0];
    if (first) this.setWeapon(first.id);
    this.play('idle');
  }

  /** Shows the held model for a weapon and moves the muzzle flash to its barrel. */
  /** Puts `obj` on top of the head (it follows the head's animation), in metres. False without a head node. */
  attachOnHead(obj: THREE.Object3D, bone = 'head'): boolean {
    const head = findNode(this.inner, bone);
    if (!head) return false;
    // A skinned mesh has no usable bounds before its first pose, so go by the figure's height:
    // the top of the head is the top of the figure, straight above the head bone in the bind pose.
    this.root.updateMatrixWorld(true);
    const at = head.getWorldPosition(new THREE.Vector3());
    const k = this.inner.scale.x;
    const holder = new THREE.Group();
    holder.scale.setScalar(1 / k);
    holder.position.set(0, (this.height - at.y) / k, 0);
    holder.add(obj);
    head.add(holder);
    return Number.isFinite(at.y);
  }

  setWeapon(id: string): void {
    if (id === this.weaponId || !this.held.has(id)) return;
    this.weaponId = id;
    for (const [k, h] of this.held) h.holder.visible = k === id;
    const { tip, style } = this.held.get(id)!;
    if (tip) this.flash.position.copy(tip);
    if (style !== this.style && this.styles.has(style)) {
      // Cross-fade into the same animation with the other arm pose.
      const cur = this.current;
      if (cur) this.actions.get(cur)?.fadeOut(FADE);
      this.style = style;
      this.actions = this.styles.get(style)!;
      this.current = null;
      if (cur) {
        this.actions.get(cur)?.reset().setEffectiveWeight(1).fadeIn(FADE).play();
        this.current = cur;
      }
    }
  }

  /** Thrown weapons have no muzzle; the flash stays hidden. */
  get hasMuzzle(): boolean {
    return !this.held.size || !!this.held.get(this.weaponId)?.tip;
  }

  play(name: CharacterAnim): void {
    if (name === this.current) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.current ? this.actions.get(this.current) : null;
    if (prev === next) {
      this.current = name;
      return;
    }
    next.reset().setEffectiveWeight(1).fadeIn(FADE).play();
    prev?.fadeOut(FADE);
    this.current = name;
  }

  /** Advances the animation; walk and run play at the actor's ground speed (m/s) over the clip's. */
  update(dt: number, speed: number): void {
    const gs = this.current === 'walk' ? this.groundSpeed.walk : this.current === 'run' ? this.groundSpeed.run : 0;
    this.mixer.timeScale = gs ? speed / gs : 1;
    this.mixer.update(dt);
  }

  light(l: number): void {
    tintModel(this.materials, l);
  }
}
