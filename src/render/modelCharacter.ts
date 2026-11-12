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
  /** Muzzle position in hand-bone space (metres), for models that carry their own gun. */
  muzzle?: [number, number, number];
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

/** Three's glTF loader strips characters such as '.' from node names ('Wrist.R' becomes 'WristR'). */
export function findNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  const o = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name)) ?? root.getObjectByName(name);
  if (!o) console.warn(`Model node '${name}' not found`);
  return o ?? null;
}

export interface ArtSet {
  guard: CharacterProfile;
  officer: CharacterProfile;
  /** Player bodies (seen by the other player in split-screen); the named material takes the player colour. */
  player?: CharacterProfile & { tintMaterial: string };
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
    tintMaterial: string;
    hand: string;
    muzzle: [number, number, number];
  };
}

// Quaternius characters carry their own skinned pistol that follows every gun animation.
const Q_MUZZLE: [number, number, number] = [0.02, 0.06, 0.3];

export const PROFILES: Record<string, ArtSet> = {
  quaternius: {
    guard: {
      model: 'quaternius/Swat.glb',
      clips: { idle: 'Idle_Gun', alert: 'Idle_Gun_Pointing', walk: 'Walk', run: 'Run', aim: 'Idle_Gun_Pointing', shoot: 'Idle_Gun_Shoot', die: 'Death' },
      hand: 'Wrist.R',
      muzzle: Q_MUZZLE,
    },
    officer: {
      model: 'quaternius/Suit.glb',
      clips: { idle: 'Idle', alert: 'Idle_Gun_Pointing', walk: 'Walk', run: 'Run', aim: 'Idle_Gun_Pointing', shoot: 'Idle_Gun_Shoot', die: 'Death' },
      hand: 'Wrist.R',
      muzzle: Q_MUZZLE,
    },
    player: {
      model: 'quaternius/Swat.glb',
      clips: { idle: 'Idle_Gun', alert: 'Idle_Gun', walk: 'Walk', run: 'Run', aim: 'Idle_Gun_Pointing', shoot: 'Idle_Gun_Shoot', die: 'Death' },
      hand: 'Wrist.R',
      muzzle: Q_MUZZLE,
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

export function profileModels(art: string): string[] {
  const set = PROFILES[art];
  if (!set) return [];
  const profiles = [set.guard, set.officer, ...(set.player ? [set.player] : [])];
  return [...profiles.flatMap((p) => [p.model, ...(p.gun ? [p.gun.model] : [])]), ...(set.viewGun ? [set.viewGun.model] : []), ...(set.viewArms ? [set.viewArms.model] : [])];
}

const FADE = 0.18;

/** Animated glTF character driven by sim state. Faces -z like the box humanoid. */
export class ModelCharacter {
  readonly root = new THREE.Group();
  readonly flash: THREE.Object3D;
  /** The hand-held gun, exposed for placement tuning. */
  readonly gun: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: CharacterAnim | null = null;
  private materials: THREE.MeshStandardMaterial[];

  constructor(
    model: ModelInstance,
    private profile: CharacterProfile,
    height: number,
    flashMaterial: THREE.Material,
    gunModel: ModelInstance | null,
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
    this.materials = [...model.materials, ...(gunModel?.materials ?? [])];
    this.mixer = new THREE.AnimationMixer(inner);
    for (const clip of model.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    const die = this.actions.get(profile.clips.die);
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
    } else if (profile.muzzle) {
      // The model holds its own gun; nothing to add.
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
    } else if (profile.muzzle) {
      // Pose the gun in the aiming clip once, then pin the flash to the barrel tip in hand space.
      const aim = this.actions.get(profile.clips.aim);
      aim?.play();
      this.mixer.update(0.3);
      const tip = findMuzzle(inner, hand);
      aim?.stop();
      if (tip) {
        flash.position.copy(tip);
        flash.scale.setScalar(1 / inner.scale.x);
        hand.add(flash);
      } else {
        flash.position.set(...profile.muzzle);
        holder.add(flash);
      }
    } else {
      flash.position.set(0, 0, 0.25);
      holder.add(flash);
    }
    this.flash = flash;
    this.play('idle');
  }

  play(name: CharacterAnim): void {
    if (name === this.current) return;
    const next = this.actions.get(this.profile.clips[name]);
    if (!next) return;
    const prev = this.current ? this.actions.get(this.profile.clips[this.current]) : null;
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
