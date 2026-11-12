import * as THREE from 'three';
import { flatMaterial, shadedBox } from './shapes';
import type { ModelInstance } from './models';
import { findMuzzle, findNode } from './modelCharacter';

export interface ViewModel {
  root: THREE.Group;
  gun: THREE.Group;
  flash: THREE.Object3D;
  /** Drives the arms' pose when the view model is a skinned character. */
  mixer?: THREE.AnimationMixer;
}

export interface ViewArmsSpec {
  clip: string;
  collapse: string[];
  headOffset: [number, number, number];
  hand: string;
  /** Muzzle in hand-bone space (metres); the model carries its own gun. */
  muzzle: [number, number, number];
  height: number;
}

/**
 * First-person arms from the player's own character model: the whole figure stands at the camera
 * in an aiming pose, with head and other parts that could block the view collapsed to nothing.
 */
export function buildModelArmsViewModel(arms: ModelInstance, spec: ViewArmsSpec): ViewModel {
  const root = new THREE.Group();
  const gun = new THREE.Group();
  root.add(gun);
  const body = arms.object;
  body.rotation.y = Math.PI;
  const box = new THREE.Box3().setFromObject(body, true);
  body.scale.setScalar(spec.height / (box.max.y - box.min.y || 1));
  for (const name of spec.collapse) findNode(body, name)?.scale.setScalar(0.0001);
  const mixer = new THREE.AnimationMixer(body);
  const clip = arms.animations.find((c) => c.name === spec.clip);
  if (clip) mixer.clipAction(clip).play();
  mixer.update(0.5);
  // Put the head bone at the requested spot relative to the camera.
  gun.add(body);
  gun.updateMatrixWorld(true);
  const head = findNode(body, 'Head');
  const hp = new THREE.Vector3();
  head?.getWorldPosition(hp);
  body.position.set(spec.headOffset[0] - hp.x, spec.headOffset[1] - hp.y, spec.headOffset[2] - hp.z);
  // Muzzle flash at the gun the model holds, in metres of hand space.
  const hand = findNode(body, spec.hand) ?? body;
  const holder = new THREE.Group();
  holder.scale.setScalar(1 / body.scale.x);
  hand.add(holder);
  const flashMat = new THREE.MeshBasicMaterial({
    color: '#ffd27a',
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const flashGeo = new THREE.PlaneGeometry(0.08, 0.08);
  const flash = new THREE.Mesh(flashGeo, flashMat);
  const f2 = new THREE.Mesh(flashGeo, flashMat);
  f2.rotation.y = Math.PI / 2;
  const f3 = new THREE.Mesh(flashGeo, flashMat);
  f3.rotation.x = Math.PI / 2;
  flash.add(f2, f3);
  flash.visible = false;
  const tip = findMuzzle(body, hand);
  if (tip) {
    flash.position.copy(tip);
    flash.scale.setScalar(1 / body.scale.x);
    hand.add(flash);
  } else {
    flash.position.set(...spec.muzzle);
    holder.add(flash);
  }
  return { root, gun, flash, mixer };
}

/** First-person pistol and sleeve, built from boxes, in camera space (-z forward). */
export interface ViewGunPlacement {
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
}

export function buildPistolViewModel(sleeve: string, gunModel: ModelInstance | null = null, place?: ViewGunPlacement): ViewModel {
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
  if (gunModel && place) {
    // A real pistol model replaces the box slide, frame, grip and sight.
    const g = gunModel.object;
    g.scale.setScalar(place.scale);
    g.position.set(...place.position);
    g.rotation.set(...place.rotation);
    gun.add(g, hand, arm);
  } else {
    gun.add(slide, frame, grip, sight, hand, arm);
  }

  const flashMat = new THREE.MeshBasicMaterial({
    color: '#ffd27a',
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const flashGeo = new THREE.PlaneGeometry(0.11, 0.11);
  const flash = new THREE.Mesh(flashGeo, flashMat);
  const flash2 = new THREE.Mesh(flashGeo, flashMat);
  flash2.rotation.y = Math.PI / 2;
  const flash3 = new THREE.Mesh(flashGeo, flashMat);
  flash3.rotation.x = Math.PI / 2;
  flash.add(flash2, flash3);
  flash.position.set(0, 0.03, -0.24);
  flash.visible = false;
  gun.add(flash);

  root.position.set(0.15, -0.15, -0.36);
  root.scale.setScalar(0.72);
  return { root, gun, flash };
}

export interface ViewModelPose {
  sinceShot: number;
  /** 0..1 progress through a reload, or -1 when not reloading. */
  reload: number;
  bobPhase: number;
  bobAmount: number;
  alive: boolean;
}

export function poseViewModel(vm: ViewModel, p: ViewModelPose): void {
  const kick = Math.exp(-p.sinceShot * 16);
  const dip = p.reload >= 0 ? Math.sin(Math.PI * p.reload) : 0;
  const bx = Math.sin(p.bobPhase) * 0.012 * p.bobAmount;
  const by = -Math.abs(Math.cos(p.bobPhase)) * 0.012 * p.bobAmount;
  vm.gun.position.set(bx, by - dip * 0.16, kick * 0.05);
  vm.gun.rotation.set(kick * 0.22 - dip * 0.7, 0, dip * 0.5);
  vm.flash.visible = p.sinceShot < 0.05;
  vm.flash.rotation.z = p.sinceShot * 40;
  vm.root.visible = p.alive;
}
