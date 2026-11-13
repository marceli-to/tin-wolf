import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EntityDef } from '../data/schema';
import { floorAtWorld, type Grid } from '../sim/grid';
import { flatMaterial, shadedBox } from './shapes';

type MarkerDef = Extract<EntityDef, { type: 'marker' }>;

const LINE = '#4a6a96';
const INK = '#1f2a44';
const CARD = '#fff8e8';
const POST = '#8a6a48';
const DASH = 1.6;
const GAP = 0.6;
const BOARD: [number, number] = [2, 1];

/**
 * Sign face: the text in the game's font on a cream card with a navy rim; with `paint`, the text
 * alone in that colour on a transparent ground (for painting on the floor).
 */
function signTexture(text: string, paint?: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const font = "600 76px Fredoka, ui-rounded, 'Arial Rounded MT Bold', sans-serif";
  const draw = (): void => {
    ctx.clearRect(0, 0, 256, 128);
    if (!paint) {
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = CARD;
      ctx.beginPath();
      ctx.roundRect(10, 10, 236, 108, 14);
      ctx.fill();
    }
    ctx.fillStyle = paint ?? INK;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 70);
    tex.needsUpdate = true;
  };
  draw();
  // The font may still be loading the first time a level opens.
  document.fonts?.load(font).then(draw, () => {});
  return tex;
}

/**
 * A distance marker: a dashed line painted across the ground and a sign on a post at each end,
 * both facing the marker's yaw (toward the shooter).
 */
export function buildMarker(m: MarkerDef, grid: Grid): THREE.Group {
  const s = grid.size;
  const [c, r] = m.cell;
  const x = Number.isInteger(c) ? (c + 0.5) * s : c * s;
  const z = Number.isInteger(r) ? (r + 0.5) * s : r * s;
  const yaw = (m.yaw * Math.PI) / 180;
  const group = new THREE.Group();
  group.name = `marker:${m.text}`;
  group.position.set(x, floorAtWorld(grid, x, z) ?? 0, z);
  // Local -z faces the yaw, local x runs along the line.
  group.rotation.y = -yaw;

  const paint = new THREE.MeshBasicMaterial({ color: LINE, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const dashes: THREE.BufferGeometry[] = [];
  const half = m.width / 2;
  for (let a = -half; a < half - 0.01; a += DASH + GAP) {
    const len = Math.min(DASH, half - a);
    const g = new THREE.PlaneGeometry(len, 0.3);
    g.rotateX(-Math.PI / 2);
    g.translate(a + len / 2, 0.01, 0);
    dashes.push(g);
  }
  // The distance painted on the ground just in front of the line, readable from the shooter's side and
  // stretched lengthwise, since it is only ever seen at a low angle.
  const labels: THREE.BufferGeometry[] = [];
  for (const at of [-half / 2, 0, half / 2]) {
    const g = new THREE.PlaneGeometry(3.6, 3.6);
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.PI);
    g.translate(at, 0.012, -2.3);
    labels.push(g);
  }
  const line = mergeGeometries(dashes);
  const label = mergeGeometries(labels);
  for (const g of [...dashes, ...labels]) g.dispose();
  if (line) group.add(new THREE.Mesh(line, paint));
  if (label) {
    const mat = new THREE.MeshBasicMaterial({ map: signTexture(m.text, LINE), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    group.add(new THREE.Mesh(label, mat));
  }

  const face = new THREE.MeshBasicMaterial({ map: signTexture(m.text) });
  const post = flatMaterial(POST);
  const back = flatMaterial(CARD);
  const [bw, bh] = BOARD;
  const top = 2.3;
  for (const side of [-1, 1]) {
    const sign = new THREE.Group();
    sign.position.x = side * half;
    const stick = new THREE.Mesh(shadedBox(0.08, top - bh, 0.08), post);
    stick.position.y = (top - bh) / 2;
    const board = new THREE.Mesh(shadedBox(bw, bh, 0.06), back);
    board.position.y = top - bh / 2;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.02, bh - 0.02), face);
    front.position.set(0, top - bh / 2, -0.031);
    front.rotation.y = Math.PI;
    sign.add(stick, board, front);
    group.add(sign);
  }
  return group;
}
