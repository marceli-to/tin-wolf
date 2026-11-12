import * as THREE from 'three';
import { flatMaterial, shadedBox } from './shapes';

export interface Humanoid {
  root: THREE.Group;
  /** Pivot at the hips; lowered when crouching. */
  body: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  /** Arm holding the gun, raised when aiming. */
  gun: THREE.Mesh;
  materials: THREE.MeshBasicMaterial[];
}

export interface HumanoidColors {
  body: string;
  legs: string;
  skin: string;
  head?: string;
}

/** Low-poly figure from boxes, ~1.75 m tall, facing -z. */
export function buildHumanoid(c: HumanoidColors): Humanoid {
  const mBody = flatMaterial(c.body);
  const mLegs = flatMaterial(c.legs);
  const mSkin = flatMaterial(c.skin);
  const mHead = flatMaterial(c.head ?? c.skin);
  const mGun = flatMaterial('#222428');
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.88;
  root.add(body);

  const torso = new THREE.Mesh(shadedBox(0.46, 0.58, 0.26), mBody);
  torso.position.y = 0.31;
  body.add(torso);
  const head = new THREE.Mesh(shadedBox(0.24, 0.26, 0.26), mHead);
  head.position.y = 0.74;
  body.add(head);

  const leg = (x: number): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(x, 0, 0);
    const m = new THREE.Mesh(shadedBox(0.18, 0.86, 0.2), mLegs);
    m.position.y = -0.43;
    g.add(m);
    body.add(g);
    return g;
  };
  const arm = (x: number): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(x, 0.55, 0);
    const m = new THREE.Mesh(shadedBox(0.13, 0.56, 0.14), mBody);
    m.position.y = -0.26;
    g.add(m);
    const hand = new THREE.Mesh(shadedBox(0.11, 0.1, 0.12), mSkin);
    hand.position.y = -0.58;
    g.add(hand);
    body.add(g);
    return g;
  };
  const legL = leg(-0.12);
  const legR = leg(0.12);
  const armL = arm(-0.3);
  const armR = arm(0.3);
  const gun = new THREE.Mesh(shadedBox(0.06, 0.12, 0.26), mGun);
  gun.position.set(0, -0.64, -0.08);
  armR.add(gun);
  return { root, body, torso, head, legL, legR, armL, armR, gun, materials: [mBody, mLegs, mSkin, mHead, mGun] };
}

export interface PoseInput {
  /** Walk cycle phase in radians. */
  phase: number;
  /** 0..1 how much the legs swing. */
  stride: number;
  crouch: number;
  /** 0..1 arm raised to aim. */
  aim: number;
  /** Aim pitch in radians. */
  pitch: number;
}

export function poseHumanoid(h: Humanoid, p: PoseInput): void {
  const swing = Math.sin(p.phase) * 0.7 * p.stride;
  h.body.position.y = 0.88 - p.crouch * 0.42;
  h.legL.rotation.x = swing + p.crouch * 1.1;
  h.legR.rotation.x = -swing + p.crouch * 1.1;
  h.armL.rotation.x = -swing * 0.6 * (1 - p.aim);
  h.armR.rotation.x = swing * 0.6 * (1 - p.aim) + p.aim * (Math.PI / 2 + p.pitch);
  h.torso.rotation.x = 0;
}
