import * as THREE from 'three';
import type { Target } from '../sim/targets';
import { BULLSEYE } from '../sim/targets';
import type { ModelInstance } from './models';
import { flatMaterial, shadedBox } from './shapes';

/** Board radius of an art set's target model (`hinge` / `board` nodes, front +Z, metres). */
export const TARGET_MODEL_RADIUS = 0.45;

/** Ring radii (fraction of the board radius) and colours, outside in. The last ring is the bullseye. */
const RINGS: [number, string][] = [
  [1, '#1f2a44'],
  [0.9, '#fff8e8'],
  [0.68, '#e9453a'],
  [0.48, '#fff8e8'],
  [BULLSEYE, '#e9453a'],
];

export interface TargetVisual {
  root: THREE.Object3D;
  hinge: THREE.Object3D;
  /** Sign of `hinge.rotation.x` that tips the board backwards. */
  tip: 1 | -1;
}

/** A round board on a post, hinged at the board's bottom edge so it can tip back. */
export function buildTarget(t: Target, model?: ModelInstance | null): TargetVisual {
  const hingeY = t.y - t.baseY - t.radius;
  const own = model ? fromModel(model, t, hingeY) : null;
  if (own) return own;
  const root = new THREE.Group();
  const post = flatMaterial('#8a6a48');
  const stick = new THREE.Mesh(shadedBox(0.07, hingeY, 0.07), post);
  stick.position.y = hingeY / 2;
  const foot = new THREE.Mesh(shadedBox(0.4, 0.06, 0.4), post);
  foot.position.y = 0.03;
  root.add(stick, foot);

  const hinge = new THREE.Group();
  hinge.position.y = hingeY;
  root.add(hinge);
  const board = new THREE.Group();
  board.position.y = t.radius;
  hinge.add(board);
  // Face toward local -z (the root is turned so -z is the target's yaw); a cream back on +z.
  RINGS.forEach(([f, color], i) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(t.radius * f, 40), new THREE.MeshBasicMaterial({ color }));
    disc.rotation.y = Math.PI;
    disc.position.z = -0.025 - i * 0.003;
    board.add(disc);
  });
  const back = new THREE.Mesh(new THREE.CylinderGeometry(t.radius, t.radius, 0.05, 40), new THREE.MeshBasicMaterial({ color: '#d9c7a4' }));
  back.rotation.x = Math.PI / 2;
  board.add(back);
  root.rotation.y = -t.yaw;
  return { root, hinge, tip: 1 };
}

/**
 * The art set's model: the board scaled to the target's radius about its hinge, the hinge moved to the
 * sim's height (the post stays as modelled). The model faces +Z, so it is turned to face the target's yaw (-Z).
 */
function fromModel(model: ModelInstance, t: Target, hingeY: number): TargetVisual | null {
  const root = model.object;
  const hinge = root.getObjectByName('hinge');
  const board = root.getObjectByName('board');
  if (!hinge || !board) return null;
  hinge.position.y = hingeY;
  board.scale.multiplyScalar(t.radius / TARGET_MODEL_RADIUS);
  root.rotation.y = Math.PI - t.yaw;
  return { root, hinge, tip: -1 };
}

/** Ground rail of a moving target, from end to end. */
export function buildRail(t: Target): THREE.Object3D | null {
  const r = t.rail;
  if (!r) return null;
  const len = Math.hypot(r.bx - r.ax, r.bz - r.az);
  const m = new THREE.Mesh(shadedBox(0.18, 0.08, len + 0.5), flatMaterial('#e0a92a'));
  m.position.set((r.ax + r.bx) / 2, t.baseY + 0.04, (r.az + r.bz) / 2);
  m.rotation.y = Math.atan2(r.bx - r.ax, r.bz - r.az);
  return m;
}

/** Follows the sim: position on the rail, and tipped back by how far the target has fallen. */
export function poseTarget(v: TargetVisual, t: Target): void {
  v.root.position.set(t.x, t.baseY, t.z);
  v.hinge.rotation.x = v.tip * (1 - t.up) * (Math.PI / 2);
}
