import * as THREE from 'three';
import type { ModelInstance } from './models';
import { measureHeight, tintModel } from './models';
import { flatMaterial, shadedBox } from './shapes';

/** Game-side animation names; each art set maps them to its own clip names. */
export type CharacterAnim = 'idle' | 'alert' | 'walk' | 'run' | 'aim' | 'shoot' | 'die';

export interface CharacterProfile {
  model: string;
  clips: Record<CharacterAnim, string>;
  /** Bone the gun is parented to. */
  hand: string;
  /** Optional gun model and its placement in hand-bone space (metres, radians). */
  gun?: { model: string; scale: number; position: [number, number, number]; rotation: [number, number, number] };
  /** Placement of the fallback box gun when no gun model is given. */
  boxGun?: { position: [number, number, number] };
  /** Meshes in the model file to hide (e.g. a prop it ships with). */
  hide?: string[];
  /** Material recoloured by a guard's `uniform`. */
  tintMaterial?: string;
  /** Replacement for the gun the model carries; placed in the built-in gun's pose. */
  heldGun?: string;
  /** Muzzle position in hand-bone space (metres), for models that carry their own gun. */
  muzzle?: [number, number, number];
  /** For models without a gun of their own: where held guns go in the hand bone (model units). */
  grip?: GripSpec;
  /**
   * Arm pose layered over every animation but death: tracks of `bones` come from `clip` (and from
   * `shootClip` while shooting), so a figure walks and runs with its gun raised.
   */
  armed?: { clip: string; shootClip: string; bones: string[] };
}

export interface GripSpec {
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
export function buildClips(animations: THREE.AnimationClip[], profile: CharacterProfile): Map<CharacterAnim, THREE.AnimationClip> {
  const byName = new Map(animations.map((c) => [c.name, c]));
  const out = new Map<CharacterAnim, THREE.AnimationClip>();
  const armed = profile.armed;
  const isArm = (t: THREE.KeyframeTrack): boolean => !!armed && armed.bones.some((b) => t.name.startsWith(`${THREE.PropertyBinding.sanitizeNodeName(b)}.`));
  for (const [anim, name] of Object.entries(profile.clips) as [CharacterAnim, string][]) {
    const base = byName.get(name);
    if (!base) continue;
    const pose = armed && anim !== 'die' ? byName.get(anim === 'shoot' ? armed.shootClip : armed.clip) : null;
    if (!pose) {
      out.set(anim, base);
      continue;
    }
    const tracks = [...base.tracks.filter((t) => !isArm(t)), ...pose.tracks.filter(isArm)];
    out.set(anim, new THREE.AnimationClip(`${anim}+armed`, base.duration, tracks));
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

/**
 * Replace the gun a character model carries (skinned to its hand) with another gun model, placed in
 * exactly the same pose: the built-in gun's bind transform gives its placement in hand space, and the
 * new gun is scaled to the same length and centred on it. `flip` turns the new gun round if its barrel
 * points the other way. Returns the new gun, or null (built-in gun kept) if the model has no usable gun.
 */
/** Barrel tip of an arbitrary (non-skinned) gun object, in hand space. */
export function findMuzzleIn(gun: THREE.Object3D, hand: THREE.Object3D): THREE.Vector3 | null {
  const named = gun.name || 'heldGun';
  gun.name = named;
  return findMuzzle(gun.parent ?? gun, hand, named);
}

export interface SwapOptions {
  /** Name of the gun node the model ships with. */
  builtin?: string;
  /** Rotate pack axes into the built-in gun's axes (default true). */
  flip?: boolean;
  /**
   * Reference gun from the same pack: scale and centre come from it, so every gun of the pack keeps its
   * real size relative to the reference (an SMG is longer than the pistol) and its grip in the hand.
   */
  ref?: THREE.Object3D;
  /** Size relative to the built-in gun instead (e.g. 0.6 for a grenade in the palm). */
  relSize?: number;
}

/**
 * Gun-pack axes (barrel +x, up +y) to the Quaternius characters' built-in pistol mesh (barrel -x,
 * slide up +z, grip toward -z). A plain half-turn about y left every gun lying on its side.
 */
const PACK_TO_BUILTIN = new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));

export function swapHeldGun(root: THREE.Object3D, hand: THREE.Object3D, gun: THREE.Object3D, opts: SwapOptions = {}): THREE.Object3D | null {
  const node = root.getObjectByName(opts.builtin ?? 'Pistol');
  if (!node) return null;
  const skinned: THREE.SkinnedMesh[] = [];
  node.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh);
  });
  const first = skinned[0];
  if (!first) return null;
  const bi = first.skeleton.bones.indexOf(hand as THREE.Bone);
  if (bi < 0) return null;
  // Hand space ← gun mesh space for a mesh rigidly skinned to the hand bone.
  const toHand = new THREE.Matrix4().multiplyMatrices(first.skeleton.boneInverses[bi]!, first.bindMatrix);
  const oldBox = new THREE.Box3();
  for (const m of skinned) {
    m.geometry.computeBoundingBox();
    oldBox.union(m.geometry.boundingBox!);
  }
  gun.updateMatrixWorld(true);
  const basis = opts.ref && !opts.relSize ? opts.ref : gun;
  basis.updateMatrixWorld(true);
  const newBox = new THREE.Box3().setFromObject(basis);
  const oldSize = oldBox.getSize(new THREE.Vector3());
  const newSize = newBox.getSize(new THREE.Vector3());
  const scale = (Math.max(oldSize.x, oldSize.y, oldSize.z) / Math.max(newSize.x, newSize.y, newSize.z)) * (opts.relSize ?? 1);
  const align = new THREE.Matrix4()
    .makeTranslation(oldBox.getCenter(new THREE.Vector3()))
    .multiply(opts.flip ?? true ? PACK_TO_BUILTIN : new THREE.Matrix4())
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
    .multiply(new THREE.Matrix4().makeTranslation(newBox.getCenter(new THREE.Vector3()).negate()));
  const holder = new THREE.Group();
  holder.matrixAutoUpdate = false;
  holder.matrix.multiplyMatrices(toHand, align);
  holder.add(gun);
  hand.add(holder);
  node.visible = false;
  return holder;
}

/** One held weapon per weapon id, all placed in the hand; only the drawn one is visible. */
export interface HeldGun {
  id: string;
  model: ModelInstance;
  fit: 'gun' | 'hand';
}

/** Three's glTF loader strips characters such as '.' from node names ('Wrist.R' becomes 'WristR'). */
export function findNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  const o = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name)) ?? root.getObjectByName(name);
  if (!o) console.warn(`Model node '${name}' not found`);
  return o ?? null;
}

/** Render-only replacement for a data entry's model when an art set is active. */
export interface ModelOverride {
  /** Model path, or null to fall back to the code-built shape. */
  model: string | null;
  modelScale?: number;
  modelFit?: 'scale' | 'footprint' | 'stretch';
}

export interface ArtSet {
  guard: CharacterProfile;
  officer: CharacterProfile;
  /** Alternative outfits a guard can wear via `look` (same rig and animations). */
  looks?: Record<string, CharacterProfile>;
  /** Player bodies (seen by the other player in split-screen); the named material takes the player colour. */
  player?: CharacterProfile & { tintMaterial?: string };
  /** Player body per slot, instead of tinting one shared model. */
  playerModels?: string[];
  /** Reference gun: every gun keeps its size relative to it (packs whose characters carry a gun). */
  gunRef?: string;
  /** Models used instead of the ones named in props.json, items.json and weapons.json. */
  overrides?: {
    props?: Record<string, ModelOverride>;
    items?: Record<string, ModelOverride>;
    weapons?: Record<string, ModelOverride>;
  };
  /** Level surfaces drawn flat and clean (no grime, rivets or noise) to match the models. */
  flatTextures?: boolean;
  /** First-person gun model and its placement in view-model space (used when there are no view arms). */
  viewGun?: { model: string; scale: number; position: [number, number, number]; rotation: [number, number, number] };
  /** First-person arms: the player model in an aiming pose, head collapsed, placed at the camera. */
  viewArms?: {
    model: string;
    clip: string;
    /** Bones scaled to zero so they never block the view. */
    collapse: string[];
    /** Where the model's head bone sits relative to the camera (metres; x right, y up, z back). */
    headOffset: [number, number, number];
    tintMaterial?: string;
    hand: string;
    muzzle: [number, number, number];
    heldGun?: string;
    /** Head bone placed at `headOffset` (default 'Head'). */
    headBone?: string;
    grip?: GripSpec;
    /** First person shows the gun alone, without the figure's hand. */
    gunOnly?: boolean;
  };
}

// Quaternius characters carry their own skinned pistol that follows every gun animation.
const Q_MUZZLE: [number, number, number] = [0.02, 0.06, 0.3];
/** Reference gun of the Ultimate Gun Pack: every pack gun is scaled relative to it. */
export const Q_GUN = 'quaternius/guns/Pistol_5.glb';

export const PROFILES: Record<string, ArtSet> = {
  quaternius: {
    guard: {
      model: 'quaternius/Swat.glb',
      clips: { idle: 'Idle_Gun', alert: 'Idle_Gun_Pointing', walk: 'Walk', run: 'Run', aim: 'Idle_Gun_Pointing', shoot: 'Idle_Gun_Shoot', die: 'Death' },
      hand: 'Wrist.R',
      muzzle: Q_MUZZLE,
      heldGun: Q_GUN,
      tintMaterial: 'Swat',
    },
    officer: {
      model: 'quaternius/Suit.glb',
      clips: { idle: 'Idle', alert: 'Idle_Gun_Pointing', walk: 'Walk', run: 'Run', aim: 'Idle_Gun_Pointing', shoot: 'Idle_Gun_Shoot', die: 'Death' },
      hand: 'Wrist.R',
      muzzle: Q_MUZZLE,
      heldGun: Q_GUN,
    },
    looks: {
      worker: {
        model: 'quaternius/Worker.glb',
        clips: { idle: 'Idle_Gun', alert: 'Idle_Gun_Pointing', walk: 'Walk', run: 'Run', aim: 'Idle_Gun_Pointing', shoot: 'Idle_Gun_Shoot', die: 'Death' },
        hand: 'Wrist.R',
        muzzle: Q_MUZZLE,
        heldGun: Q_GUN,
      },
    },
    player: {
      model: 'quaternius/Swat.glb',
      clips: { idle: 'Idle_Gun', alert: 'Idle_Gun', walk: 'Walk', run: 'Run', aim: 'Idle_Gun_Pointing', shoot: 'Idle_Gun_Shoot', die: 'Death' },
      hand: 'Wrist.R',
      muzzle: Q_MUZZLE,
      heldGun: Q_GUN,
      tintMaterial: 'Swat',
    },
    viewGun: { model: 'quaternius/Pistol.glb', scale: 0.25, position: [0.01, -0.03, 0.0], rotation: [0.06, -Math.PI / 2, 0] },
    viewArms: {
      model: 'quaternius/Swat.glb',
      clip: 'Idle_Gun_Pointing',
      collapse: ['Head', 'Neck', 'Shoulder.L', 'UpperLeg.L', 'UpperLeg.R'],
      hand: 'Wrist.R',
      muzzle: Q_MUZZLE,
      headOffset: [0.08, -0.17, 0.02],
      tintMaterial: 'Swat',
    },
  },
};

// Kenney Mini Characters: blocky rigid parts (root, legs, torso, arms, head), no gun of their own.
// In bind pose the right arm points along the bone's -x with the fist at its end.
const K_GRIP: GripSpec = { position: [-0.27, 0.0, 0.02], rotation: [0, Math.PI / 2 + 0.5, 0], scale: 0.4 };
const K_CLIPS: Record<CharacterAnim, string> = {
  idle: 'idle',
  alert: 'holding-right',
  walk: 'walk',
  run: 'sprint',
  aim: 'holding-right',
  shoot: 'holding-right-shoot',
  die: 'die',
};
const kenneyChar = (file: string): CharacterProfile => ({
  model: `kenney/characters/${file}.glb`,
  clips: K_CLIPS,
  hand: 'arm-right',
  grip: K_GRIP,
  armed: { clip: 'holding-right', shootClip: 'holding-right-shoot', bones: ['arm-right'] },
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
    collapse: ['head', 'leg-left', 'leg-right', 'arm-left'],
    headBone: 'head',
    hand: 'arm-right',
    muzzle: [0, 0, 0],
    headOffset: [-0.3, -0.31, 0.04],
    // Smaller than in third person: up close the toy blasters filled a quarter of the screen.
    grip: { ...K_GRIP, position: [-0.29, 0.03, 0.02], scale: 0.26 },
    gunOnly: true,
  },
  flatTextures: true,
  overrides: {
    props: {
      console: { model: 'kenney/space-station/computer-wide.glb', modelFit: 'stretch' },
      terminal: { model: 'kenney/space-station/computer-system.glb', modelFit: 'stretch' },
      crate: { model: 'kenney/survival/box.glb', modelFit: 'stretch' },
      crate_tall: { model: 'kenney/factory/box-large.glb', modelFit: 'stretch' },
      crate_large: { model: 'kenney/factory/box-long.glb', modelFit: 'stretch' },
      cargo: { model: 'kenney/factory/box-wide.glb', modelFit: 'stretch' },
      barrel: { model: 'kenney/survival/barrel.glb', modelFit: 'stretch' },
      barrel_small: { model: 'kenney/survival/barrel.glb', modelFit: 'stretch' },
      chest: { model: 'kenney/survival/chest.glb', modelFit: 'stretch' },
      ammo_crate: { model: 'kenney/blasters/crate-small.glb', modelFit: 'footprint' },
      locker: { model: 'kenney/furniture/bookcaseClosedDoors.glb', modelFit: 'stretch' },
      shelf: { model: 'kenney/furniture/bookcaseOpen.glb', modelFit: 'stretch' },
      shelf_wide: { model: 'kenney/furniture/bookcaseClosedWide.glb', modelFit: 'stretch' },
      shelf_low: { model: 'kenney/furniture/bookcaseOpenLow.glb', modelFit: 'stretch' },
      lab_desk: { model: 'kenney/space-station/table-large.glb', modelFit: 'stretch' },
      lab_desk_small: { model: 'kenney/space-station/table.glb', modelFit: 'stretch' },
      lab_desk_corner: { model: 'kenney/furniture/deskCorner.glb', modelFit: 'stretch' },
      lab_chair: { model: 'kenney/space-station/chair.glb', modelFit: 'footprint' },
      satellite_dish: { model: 'kenney/space/satelliteDish_large.glb', modelFit: 'footprint' },
      desk: { model: 'kenney/furniture/desk.glb', modelFit: 'stretch' },
      office_chair: { model: 'kenney/furniture/chairDesk.glb', modelFit: 'footprint' },
      bookcase: { model: 'kenney/furniture/bookcaseClosedWide.glb', modelFit: 'stretch' },
      closet: { model: 'kenney/furniture/bookcaseClosedDoors.glb', modelFit: 'stretch' },
      side_table: { model: 'kenney/furniture/sideTableDrawers.glb', modelFit: 'stretch' },
      bunk_bed: { model: 'kenney/furniture/bedBunk.glb', modelFit: 'footprint' },
      mess_table: { model: 'kenney/furniture/table.glb', modelFit: 'stretch' },
      chair: { model: 'kenney/furniture/chair.glb', modelFit: 'footprint' },
      stool: { model: 'kenney/furniture/stoolBar.glb', modelFit: 'footprint' },
      armchair: { model: 'kenney/furniture/loungeChair.glb', modelFit: 'footprint' },
    },
    items: {
      // No keycard or medkit in the Kenney kits: the code-built shapes are flat-coloured anyway.
      key_red: { model: null },
      key_blue: { model: null },
      medkit: { model: null },
      ammo_pistol: { model: 'kenney/blasters/clip-small.glb', modelScale: 1.6 },
      ammo_smg: { model: 'kenney/blasters/clip-large.glb', modelScale: 1.6 },
      weapon_smg: { model: 'kenney/blasters/blaster-d.glb', modelScale: 0.6 },
      weapon_pistol_sd: { model: 'kenney/blasters/blaster-h.glb', modelScale: 0.6 },
      grenades: { model: 'kenney/blasters/grenade-a.glb', modelScale: 1.4 },
    },
    weapons: {
      pistol: { model: 'kenney/blasters/blaster-k.glb' },
      pistol_sd: { model: 'kenney/blasters/blaster-h.glb' },
      smg: { model: 'kenney/blasters/blaster-d.glb' },
      grenade: { model: 'kenney/blasters/grenade-a.glb' },
    },
  },
};

PROFILES.quaternius!.gunRef = Q_GUN;

export function profileModels(art: string): string[] {
  const set = PROFILES[art];
  if (!set) return [];
  const profiles = [set.guard, set.officer, ...(set.player ? [set.player] : []), ...Object.values(set.looks ?? {})];
  return [
    ...profiles.flatMap((p) => [p.model, ...(p.gun ? [p.gun.model] : []), ...(p.heldGun ? [p.heldGun] : [])]),
    ...(set.viewArms?.heldGun ? [set.viewArms.heldGun] : []),
    ...(set.viewGun ? [set.viewGun.model] : []),
    ...(set.viewArms ? [set.viewArms.model] : []),
    ...(set.playerModels ?? []),
    ...(set.gunRef ? [set.gunRef] : []),
  ];
}

/** Applies an art set's model overrides to the (render-only) model fields of the game data. */
export function applyArtOverrides(
  set: ArtSet,
  data: { props: Record<string, { model?: string; modelScale: number; modelFit: string }>; items: Record<string, { model?: string; modelScale: number }>; weapons: Record<string, { model?: string }> },
): void {
  const apply = (table: Record<string, { model?: string; modelScale?: number; modelFit?: string }>, over: Record<string, ModelOverride> | undefined): void => {
    for (const [k, o] of Object.entries(over ?? {})) {
      const def = table[k];
      if (!def) continue;
      if (o.model === null) delete def.model;
      else def.model = o.model;
      if (o.modelScale !== undefined) def.modelScale = o.modelScale;
      if (o.modelFit !== undefined) def.modelFit = o.modelFit;
    }
  };
  apply(data.props, set.overrides?.props);
  apply(data.items, set.overrides?.items);
  apply(data.weapons, set.overrides?.weapons);
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
  private current: CharacterAnim | null = null;
  private materials: THREE.MeshStandardMaterial[];
  /** Held weapons by id, with the barrel tip in hand space (null for thrown weapons). */
  private held = new Map<string, { holder: THREE.Object3D; tip: THREE.Vector3 | null }>();
  private weaponId = '';

  /**
   * `held` lists the weapons this character can draw (one for guards, every weapon for players);
   * `ref` is the pack's reference gun, so all pack guns keep their sizes relative to it.
   */
  constructor(
    model: ModelInstance,
    profile: CharacterProfile,
    height: number,
    flashMaterial: THREE.Material,
    gunModel: ModelInstance | null,
    held: HeldGun[] = [],
    ref: THREE.Object3D | null = null,
  ) {
    const inner = model.object;
    for (const name of profile.hide ?? []) {
      const o = findNode(inner, name);
      if (o) o.visible = false;
    }
    const h = measureHeight(inner) || 1;
    inner.scale.setScalar(height / h);
    // glTF characters face +z; the game's figures face -z.
    inner.rotation.y = Math.PI;
    this.root.add(inner);
    this.materials = [...model.materials, ...(gunModel?.materials ?? []), ...held.flatMap((h) => h.model.materials)];
    this.mixer = new THREE.AnimationMixer(inner);
    for (const [anim, clip] of buildClips(model.animations, profile)) this.actions.set(anim, this.mixer.clipAction(clip));
    const die = this.actions.get('die');
    if (die) {
      die.setLoop(THREE.LoopOnce, 1);
      die.clampWhenFinished = true;
    }
    const hand = findNode(inner, profile.hand) ?? inner;
    // Undo the character's scale so gun offsets are in metres.
    const holder = new THREE.Group();
    holder.scale.setScalar(1 / inner.scale.x);
    hand.add(holder);
    if (gunModel && profile.gun) {
      const g = gunModel.object;
      g.scale.setScalar(profile.gun.scale);
      g.position.set(...profile.gun.position);
      g.rotation.set(...profile.gun.rotation);
      holder.add(g);
      this.gun = g;
    } else if (profile.muzzle || profile.grip) {
      // The model holds its own gun, or held guns go into the grip below.
      this.gun = holder;
    } else {
      const box = new THREE.Mesh(shadedBox(0.07, 0.12, 0.28), flatMaterial('#232428'));
      box.position.set(...(profile.boxGun?.position ?? [0, 0, 0]));
      holder.add(box);
      this.gun = box;
    }
    const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), flashMaterial);
    flash.visible = false;
    if (gunModel && profile.gun) {
      // Barrel tip in the pistol model's own units (barrel runs along -x).
      flash.position.set(-0.75, 0.26, 0);
      flash.scale.setScalar(1 / profile.gun.scale);
      this.gun.add(flash);
    } else if (profile.grip) {
      // Guns go into the empty hand; the flash sits on each barrel tip in hand space.
      const aim = this.actions.get('aim');
      aim?.play();
      this.mixer.update(0.3);
      inner.updateMatrixWorld(true);
      for (const h of held) {
        const holder = attachHeldGun(hand, h.model.object, profile.grip, h.fit === 'hand' ? 0.45 : undefined);
        const tip = h.fit === 'hand' ? null : findMuzzleIn(holder, hand);
        holder.visible = false;
        this.held.set(h.id, { holder, tip });
      }
      aim?.stop();
      flash.scale.setScalar(1 / inner.scale.x);
      hand.add(flash);
    } else if (profile.muzzle) {
      // Pose the gun in the aiming clip once, then pin the flash to each barrel tip in hand space.
      const aim = this.actions.get('aim');
      aim?.play();
      this.mixer.update(0.3);
      for (const h of held) {
        const holder = swapHeldGun(inner, hand, h.model.object, h.fit === 'hand' ? { relSize: 0.35 } : { ref: ref ?? undefined });
        if (!holder) continue;
        const tip = h.fit === 'hand' ? null : findMuzzleIn(holder, hand);
        holder.visible = false;
        this.held.set(h.id, { holder, tip });
      }
      const tip = this.held.size ? null : findMuzzle(inner, hand);
      aim?.stop();
      flash.scale.setScalar(1 / inner.scale.x);
      hand.add(flash);
      if (tip) flash.position.copy(tip);
      else if (!this.held.size) {
        flash.position.set(...profile.muzzle);
        flash.scale.setScalar(1);
        holder.add(flash);
      }
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
  setWeapon(id: string): void {
    if (id === this.weaponId || !this.held.has(id)) return;
    this.weaponId = id;
    for (const [k, h] of this.held) h.holder.visible = k === id;
    const tip = this.held.get(id)!.tip;
    if (tip) this.flash.position.copy(tip);
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

  update(dt: number, speedScale: number): void {
    this.mixer.timeScale = this.current === 'walk' || this.current === 'run' ? speedScale : 1;
    this.mixer.update(dt);
  }

  light(l: number): void {
    tintModel(this.materials, l);
  }
}
