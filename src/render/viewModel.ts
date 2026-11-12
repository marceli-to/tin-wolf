import * as THREE from 'three';
import { flatMaterial, shadedBox } from './shapes';
import type { ModelInstance } from './models';

export interface ViewModel {
  root: THREE.Group;
  gun: THREE.Group;
  flash: THREE.Mesh;
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
