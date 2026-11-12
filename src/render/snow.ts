import * as THREE from 'three';
import { cellAt, type Grid } from '../sim/grid';

const COUNT = 700;
const BOX = 26;

/** Falling snow around the camera, only drawn over open-sky cells. Purely visual. */
export class Snow {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private drift: Float32Array;

  constructor(private grid: Grid) {
    this.pos = new Float32Array(COUNT * 3);
    this.drift = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * BOX;
      this.pos[i * 3 + 1] = Math.random() * 8;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * BOX;
      this.drift[i] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    const m = new THREE.PointsMaterial({ color: '#f4f8fb', size: 2, sizeAttenuation: false, transparent: true, opacity: 0.85 });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }

  static wanted(grid: Grid): boolean {
    return grid.cells.some((c) => c.sky);
  }

  update(dt: number, cx: number, cz: number, time: number): void {
    const out = (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const s = this.grid.size;
    for (let i = 0; i < COUNT; i++) {
      let y = this.pos[i * 3 + 1]! - dt * 1.1;
      if (y < 0) y += 8;
      this.pos[i * 3 + 1] = y;
      // Wrap flakes around the camera so the field follows the player.
      const wx = cx + wrap(this.pos[i * 3]! + Math.sin(time * 0.7 + this.drift[i]!) * 0.3 - cx, BOX);
      const wz = cz + wrap(this.pos[i * 3 + 2]! - cz, BOX);
      const cell = cellAt(this.grid, Math.floor(wx / s), Math.floor(wz / s));
      const visible = !!cell && cell.sky && !cell.solid;
      out[i * 3] = wx;
      out[i * 3 + 1] = visible ? y : -100;
      out[i * 3 + 2] = wz;
    }
    this.points.geometry.getAttribute('position').needsUpdate = true;
  }
}

function wrap(v: number, size: number): number {
  return ((((v + size / 2) % size) + size) % size) - size / 2;
}
