import * as THREE from 'three';
import { flatMaterial, shadedBox } from './shapes';
import type { ModelInstance } from './models';
import { MuzzleFlash } from './muzzle';
import { attachHeldGun, barrelDirIn, findMuzzle, findMuzzleIn, findNode, GUN_MUZZLE_NODE, type GripSpec, type HeldGun } from './modelCharacter';

export interface ViewModel {
  root: THREE.Group;
  gun: THREE.Group;
  flash: MuzzleFlash;
  /** Shows the model for a weapon id (view models with several held weapons). */
  setWeapon?: (id: string) => void;
  /** False while a weapon without a muzzle (a grenade) is drawn. */
  muzzle: boolean;
}

export interface ViewArmsSpec {
  clip: string;
  /** Arm pose for two-handed weapons (`hold: 'two'`); default: `clip`. */
  twoClip?: string;
  /**
   * Clip for the bones the arm clips leave unkeyed (e.g. 'idle'), so they rest in a pose instead of the
   * bind pose: a one-handed aim clip keys only the right arm, and the left would stick out in a T-pose.
   */
  base?: string;
  collapse: string[];
  headOffset: [number, number, number];
  /** Head placement for two-handed weapons, whose pose holds the gun elsewhere; default: `headOffset`. */
  twoHeadOffset?: [number, number, number];
  /** Extra shift per weapon id, added to the head offset (metres; x right, y up, z back). */
  weaponOffset?: Record<string, [number, number, number]>;
  hand: string;
  /** Muzzle in hand-bone space (metres); the model carries its own gun. */
  muzzle: [number, number, number];
  height: number;
  /** Head bone placed at `headOffset` (default 'Head'). */
  headBone?: string;
  /** Empty hand: guns are attached here instead of replacing a gun the model carries. */
  grip?: GripSpec;
  /** Show only the gun: the figure's own meshes are hidden (its bones still pose the gun). */
  gunOnly?: boolean;
}

/**
 * First-person arms from the player's own character model: the whole figure stands at the camera
 * in an aiming pose, with head and other parts that could block the view collapsed to nothing.
 */
/** Distance in front of the camera where a first-person barrel meets the crosshair (metres). */
const AIM_DISTANCE = 20;
/** First-person flashes are drawn smaller: the muzzle is only half a metre from the eye. */
const FP_FLASH_SCALE = 1;

export function buildModelArmsViewModel(arms: ModelInstance, held: HeldGun[], spec: ViewArmsSpec): ViewModel {
  const root = new THREE.Group();
  const gun = new THREE.Group();
  root.add(gun);
  const body = arms.object;
  body.rotation.y = Math.PI;
  const box = new THREE.Box3().setFromObject(body, true);
  body.scale.setScalar(spec.height / (box.max.y - box.min.y || 1));
  for (const name of spec.collapse) findNode(body, name)?.scale.setScalar(0.0001);
  if (spec.gunOnly) body.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) o.visible = false;
  });
  const mixer = new THREE.AnimationMixer(body);
  const byName = (name: string | undefined) => (name ? arms.animations.find((c) => c.name === name) : undefined);
  const baseClip = byName(spec.base);
  const node = (t: THREE.KeyframeTrack) => t.name.slice(0, t.name.lastIndexOf('.'));
  const action = (name: string | undefined): THREE.AnimationAction | null => {
    let clip = byName(name);
    if (clip && baseClip) {
      const keyed = new Set(clip.tracks.map(node));
      clip = new THREE.AnimationClip(`${clip.name}+${baseClip.name}`, clip.duration, [...clip.tracks, ...baseClip.tracks.filter((t) => !keyed.has(node(t)))]);
    }
    return clip ? mixer.clipAction(clip) : null;
  };
  const poses = { one: action(spec.clip), two: action(spec.twoClip) ?? action(spec.clip) };
  // The pose is sampled once at 0.5 s and then held: the aim clips are third-person loops whose hand and
  // wrist sway (up to 14°) would make the gun wobble constantly right in front of the camera.
  poses.one?.play();
  mixer.update(0.5);
  // Put the head bone at the requested spot relative to the camera.
  gun.add(body);
  gun.updateMatrixWorld(true);
  const head = findNode(body, spec.headBone ?? 'Head');
  const hp = new THREE.Vector3();
  head?.getWorldPosition(hp);
  const place = (o: [number, number, number]) => new THREE.Vector3(o[0] - hp.x, o[1] - hp.y, o[2] - hp.z);
  const placed = { one: place(spec.headOffset), two: place(spec.twoHeadOffset ?? spec.headOffset) };
  body.position.copy(placed.one);
  // Muzzle flash at the gun the model holds, in metres of hand space.
  const hand = findNode(body, spec.hand) ?? body;
  const holder = new THREE.Group();
  holder.scale.setScalar(1 / body.scale.x);
  hand.add(holder);
  const flash = new MuzzleFlash(FP_FLASH_SCALE);
  const guns = new Map<string, { holder: THREE.Object3D; tip: THREE.Vector3 | null; dir: THREE.Vector3 | null; two: boolean; barrel: THREE.Object3D | null; muzzle: THREE.Object3D | null }>();
  for (const h of held) {
    if (!spec.grip) continue;
    const holder = attachHeldGun(hand, h.model.object, spec.grip, h.fit === 'hand' ? 0.45 : undefined);
    holder.visible = false;
    const muzzle = h.fit === 'hand' ? null : h.model.object.getObjectByName(GUN_MUZZLE_NODE) ?? null;
    const tip = h.fit === 'hand' ? null : findMuzzleIn(holder, hand);
    guns.set(h.id, { holder, tip, dir: tip ? barrelDirIn(holder, hand) : null, two: h.hold === 'two', barrel: muzzle ? h.model.object : null, muzzle });
  }
  const tip = guns.size ? null : findMuzzle(body, hand);
  flash.object.scale.setScalar(1 / body.scale.x);
  if (tip || guns.size) {
    if (tip) flash.object.position.copy(tip);
    hand.add(flash.object);
  } else {
    flash.object.position.set(...spec.muzzle);
    flash.object.scale.setScalar(1);
    holder.add(flash.object);
  }
  const vm: ViewModel = { root, gun, flash, muzzle: true };
  const baseTurn = body.quaternion.clone();
  const v = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  /**
   * Turns the whole figure about the muzzle so the barrel points at the crosshair `AIM_DISTANCE` ahead:
   * the held pose is a frame of a third-person clip, and its barrel is off by a few degrees.
   * Generator guns have their barrel along +X and a `muzzle` node; others keep the pose as it is.
   */
  const aim = (g: { barrel: THREE.Object3D | null; muzzle: THREE.Object3D | null }, at: THREE.Vector3): void => {
    body.position.copy(at);
    body.quaternion.copy(baseTurn);
    if (!g.barrel || !g.muzzle) return;
    gun.updateMatrixWorld(true);
    inv.copy(gun.matrixWorld).invert();
    const m = g.muzzle.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const dir = v.set(1, 0, 0).transformDirection(g.barrel.matrixWorld).transformDirection(inv);
    const want = new THREE.Vector3(0, 0, -AIM_DISTANCE).sub(m).normalize();
    const turn = new THREE.Quaternion().setFromUnitVectors(dir, want);
    body.position.sub(m).applyQuaternion(turn).add(m);
    body.quaternion.premultiply(turn);
  };
  let current = '';
  vm.setWeapon = (id: string): void => {
    const g = guns.get(id);
    if (!g || id === current) return;
    current = id;
    for (const [k, v] of guns) v.holder.visible = k === id;
    vm.muzzle = !!g.tip;
    if (g.tip) flash.object.position.copy(g.tip);
    flash.aim(g.dir);
    // Two-handed guns sit in the both-hands pose; the swap happens out of view, so no blend.
    const want = g.two ? poses.two : poses.one;
    if (want && !want.isRunning()) {
      mixer.stopAllAction();
      want.reset().play();
      mixer.update(0.5);
    }
    const shift = spec.weaponOffset?.[id];
    const at = (g.two ? placed.two : placed.one).clone();
    if (shift) at.add(new THREE.Vector3(...shift));
    aim(g, at);
  };
  const first = held[0];
  if (first) vm.setWeapon(first.id);
  return vm;
}

/** First-person pistol and sleeve, built from boxes, in camera space (-z forward). */
export function buildPistolViewModel(sleeve: string): ViewModel {
  const root = new THREE.Group();
  const gun = new THREE.Group();
  root.add(gun);
  const dark = flatMaterial('#2b2d31');
  const mid = flatMaterial('#45484e');
  const skin = flatMaterial('#c99a7a');
  const cloth = flatMaterial(sleeve);

  const slide = new THREE.Mesh(shadedBox(0.045, 0.05, 0.22), mid);
  slide.position.set(0, 0.03, -0.09);
  const frame = new THREE.Mesh(shadedBox(0.04, 0.03, 0.17), dark);
  frame.position.set(0, -0.005, -0.065);
  const grip = new THREE.Mesh(shadedBox(0.038, 0.11, 0.05), dark);
  grip.position.set(0, -0.06, 0.0);
  grip.rotation.x = -0.25;
  const sight = new THREE.Mesh(shadedBox(0.01, 0.012, 0.012), dark);
  sight.position.set(0, 0.06, -0.19);
  const hand = new THREE.Mesh(shadedBox(0.07, 0.08, 0.09), skin);
  hand.position.set(0.005, -0.07, 0.01);
  const arm = new THREE.Mesh(shadedBox(0.09, 0.09, 0.4), cloth);
  arm.position.set(0.02, -0.1, 0.24);
  arm.rotation.x = 0.12;
  gun.add(slide, frame, grip, sight, hand, arm);

  const flash = new MuzzleFlash(FP_FLASH_SCALE);
  flash.object.position.set(0, 0.03, -0.24);
  flash.aim(new THREE.Vector3(0, 0, -1));
  gun.add(flash.object);

  root.position.set(0.15, -0.15, -0.36);
  root.scale.setScalar(0.72);
  return { root, gun, flash, muzzle: true };
}

export interface ViewModelPose {
  sinceShot: number;
  /** 0..1 progress through a reload, or -1 when not reloading. */
  reload: number;
  bobPhase: number;
  bobAmount: number;
  alive: boolean;
  /** 0..1 progress through a weapon switch (lower, then raise), or -1. */
  switching?: number;
  /** A shot was fired since the last pose (starts a new flash). */
  fired?: string | null;
}

export function poseViewModel(vm: ViewModel, p: ViewModelPose): void {
  const kick = Math.exp(-p.sinceShot * 16);
  const dip = p.reload >= 0 ? Math.sin(Math.PI * p.reload) : 0;
  const drop = p.switching !== undefined && p.switching >= 0 ? Math.sin(Math.PI * p.switching) : 0;
  const bx = Math.sin(p.bobPhase) * 0.012 * p.bobAmount;
  const by = -Math.abs(Math.cos(p.bobPhase)) * 0.012 * p.bobAmount;
  vm.gun.position.set(bx, by - dip * 0.16 - drop * 0.35, kick * 0.05);
  vm.gun.rotation.set(kick * 0.22 - dip * 0.7 - drop * 0.6, 0, dip * 0.5);
  if (p.fired) vm.flash.fire(p.fired);
  vm.flash.update(p.sinceShot, vm.muzzle && p.alive);
  vm.root.visible = p.alive;
}
