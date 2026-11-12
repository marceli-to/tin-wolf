import * as THREE from 'three';
import type { ModelInstance } from './models';
import { measureHeight, tintModel } from './models';
import { flatMaterial, shadedBox } from './shapes';

/** Game-side animation names; each art set maps them to its own clip names. */
export type CharacterAnim = 'idle' | 'alert' | 'walk' | 'run' | 'aim' | 'shoot' | 'die' | 'crouch';

export interface CharacterProfile {
  model: string;
  clips: Record<CharacterAnim, string>;
  /** Bone the gun is parented to. */
  hand: string;
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
}

export type HoldStyle = 'one' | 'two';

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
export function buildClips(animations: THREE.AnimationClip[], profile: CharacterProfile, style: HoldStyle = 'one'): Map<CharacterAnim, THREE.AnimationClip> {
  const byName = new Map(animations.map((c) => [c.name, c]));
  const out = new Map<CharacterAnim, THREE.AnimationClip>();
  const armed = style === 'two' && profile.armed?.two ? profile.armed.two : profile.armed;
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
  /** Alternative outfits a guard can wear via `look` (same rig and animations). */
  looks?: Record<string, CharacterProfile>;
  /** Player bodies (seen by the other player in split-screen). */
  player?: CharacterProfile;
  /** Player body per slot, instead of tinting one shared model. */
  playerModels?: string[];
  /** Level surfaces drawn flat and clean (no grime, rivets or noise) to match the models. */
  flatTextures?: boolean;
  /** Brighter mood: baked light is lifted toward `lightFloor`, fog lightened toward `fogTint` and pushed back. */
  mood?: { lightFloor: number; fogTint: string; fogMix: number; fogFarScale: number };
  /** First-person arms: the player model in an aiming pose, head collapsed, placed at the camera. */
  viewArms?: {
    model: string;
    clip: string;
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
const K_CLIPS: Record<CharacterAnim, string> = {
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
  // Toy look: no pitch-dark corners and a light, distant haze instead of gloom.
  mood: { lightFloor: 0.5, fogTint: '#c4d8e8', fogMix: 0.45, fogFarScale: 1.5 },
};

export function profileModels(art: string): string[] {
  const set = PROFILES[art];
  if (!set) return [];
  const profiles = [set.guard, set.officer, ...(set.player ? [set.player] : []), ...Object.values(set.looks ?? {})];
  return [
    ...profiles.map((p) => p.model),
    ...(set.viewArms ? [set.viewArms.model] : []),
    ...(set.playerModels ?? []),
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

  update(dt: number, speedScale: number): void {
    this.mixer.timeScale = this.current === 'walk' || this.current === 'run' ? speedScale : 1;
    this.mixer.update(dt);
  }

  light(l: number): void {
    tintModel(this.materials, l);
  }
}
