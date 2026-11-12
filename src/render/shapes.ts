import * as THREE from 'three';
import { SHADE } from './palette';

/** Writes a per-vertex colour from each face normal so unlit boxes still read as 3D. */
export function shadeByNormal(g: THREE.BufferGeometry, light = 1): THREE.BufferGeometry {
  const n = g.getAttribute('normal');
  const cols: number[] = [];
  for (let i = 0; i < n.count; i++) {
    const ny = n.getY(i);
    const nx = n.getX(i);
    let s: number;
    if (ny > 0.5) s = SHADE.top;
    else if (ny < -0.5) s = SHADE.bottom;
    else if (Math.abs(nx) > 0.5) s = SHADE.ew;
    else s = SHADE.ns;
    s *= light;
    cols.push(s, s, s);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return g;
}

export function shadedBox(w: number, h: number, d: number, light = 1): THREE.BufferGeometry {
  return shadeByNormal(new THREE.BoxGeometry(w, h, d), light);
}

/** Remaps a BoxGeometry's per-face UVs to world metres so textures keep their density on any box size. */
export function worldUvBox(g: THREE.BufferGeometry, w: number, h: number, d: number, scale = 2): THREE.BufferGeometry {
  const n = g.getAttribute('normal');
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < n.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const x = pos.getX(i) + w / 2;
    const y = pos.getY(i) + h / 2;
    const z = pos.getZ(i) + d / 2;
    if (ay > 0.5) uv.setXY(i, x / scale, z / scale);
    else if (ax > 0.5) uv.setXY(i, z / scale, y / scale);
    else uv.setXY(i, x / scale, y / scale);
  }
  uv.needsUpdate = true;
  return g;
}

export function flatMaterial(color: string | THREE.Color): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, vertexColors: true });
}
