import * as THREE from 'three';
import { cellAt, floorAt, type Cell, type Grid } from '../sim/grid';
import { materialColor, SHADE } from './palette';

interface Bucket {
  pos: number[];
  nrm: number[];
  uv: number[];
  col: number[];
}

type P = [number, number, number];

class MeshBuilder {
  buckets = new Map<string, Bucket>();

  private bucket(mat: string): Bucket {
    let b = this.buckets.get(mat);
    if (!b) {
      b = { pos: [], nrm: [], uv: [], col: [] };
      this.buckets.set(mat, b);
    }
    return b;
  }

  /** Quad given counter-clockwise (front side), with per-vertex UVs and one shade value. */
  quad(mat: string, v: [P, P, P, P], uvs: [number, number][], n: P, shade: number): void {
    const b = this.bucket(mat);
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = v[i]!;
      b.pos.push(p[0], p[1], p[2]);
      b.nrm.push(n[0], n[1], n[2]);
      const uv = uvs[i]!;
      b.uv.push(uv[0], uv[1]);
      b.col.push(shade, shade, shade);
    }
  }

  build(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'level';
    for (const [mat, b] of this.buckets) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.computeBoundingSphere();
      const m = new THREE.MeshBasicMaterial({ color: materialColor(mat), vertexColors: true });
      const mesh = new THREE.Mesh(g, m);
      mesh.name = `level:${mat}`;
      mesh.userData.mat = mat;
      group.add(mesh);
    }
    return group;
  }
}

/** UVs are world-space so textures tile at a fixed density (1 repeat per TEX_SCALE metres). */
const TEX_SCALE = 2;

/**
 * Builds floors, ceilings, walls and step faces from the height grid.
 * Each shared edge compares this cell's floor/ceiling heights with the neighbour's at both edge
 * endpoints, so ramps produce correct sloped side faces without special cases.
 */
export function buildLevelMesh(grid: Grid): THREE.Group {
  const mb = new MeshBuilder();
  const s = grid.size;
  for (let cz = 0; cz < grid.h; cz++) {
    for (let cx = 0; cx < grid.w; cx++) {
      const cell = cellAt(grid, cx, cz)!;
      if (cell.solid) continue;
      const x0 = cx * s;
      const x1 = x0 + s;
      const z0 = cz * s;
      const z1 = z0 + s;
      const fh = (x: number, z: number): number => floorAt(grid, cell, cx, cz, x, z);
      const light = cell.light;
      const h00 = fh(x0, z0);
      const h10 = fh(x1, z0);
      const h01 = fh(x0, z1);
      const h11 = fh(x1, z1);
      const uvf = (x: number, z: number): [number, number] => [x / TEX_SCALE, -z / TEX_SCALE];
      mb.quad(
        cell.floorMat,
        [
          [x0, h00, z0],
          [x0, h01, z1],
          [x1, h11, z1],
          [x1, h10, z0],
        ],
        [uvf(x0, z0), uvf(x0, z1), uvf(x1, z1), uvf(x1, z0)],
        [0, 1, 0],
        SHADE.top * light,
      );
      if (!cell.sky) {
        const c = cell.ceil;
        mb.quad(
          cell.ceilMat,
          [
            [x0, c, z0],
            [x1, c, z0],
            [x1, c, z1],
            [x0, c, z1],
          ],
          [uvf(x0, z0), uvf(x1, z0), uvf(x1, z1), uvf(x0, z1)],
          [0, -1, 0],
          SHADE.bottom * light,
        );
      }
      // Each side: neighbour offset, and the edge's left/right endpoints as seen from inside this cell.
      const sides: { ox: number; oz: number; a: [number, number]; b: [number, number]; n: P; shade: number }[] = [
        { ox: 0, oz: -1, a: [x0, z0], b: [x1, z0], n: [0, 0, 1], shade: SHADE.ns },
        { ox: 0, oz: 1, a: [x1, z1], b: [x0, z1], n: [0, 0, -1], shade: SHADE.ns },
        { ox: 1, oz: 0, a: [x1, z0], b: [x1, z1], n: [-1, 0, 0], shade: SHADE.ew },
        { ox: -1, oz: 0, a: [x0, z1], b: [x0, z0], n: [1, 0, 0], shade: SHADE.ew },
      ];
      for (const side of sides) {
        const ncx = cx + side.ox;
        const ncz = cz + side.oz;
        const nb = cellAt(grid, ncx, ncz);
        const [ax, az] = side.a;
        const [bx, bz] = side.b;
        const fa = fh(ax, az);
        const fb = fh(bx, bz);
        const along = side.ox === 0 ? (x: number, z: number) => x + z * 0 : (x: number, z: number) => z + x * 0;
        const ua = along(ax, az) / TEX_SCALE;
        const ub = along(bx, bz) / TEX_SCALE;
        const wall = (mat: string, ya0: number, yb0: number, ya1: number, yb1: number): void => {
          if (ya1 - ya0 < 1e-4 && yb1 - yb0 < 1e-4) return;
          mb.quad(
            mat,
            [
              [ax, ya0, az],
              [bx, yb0, bz],
              [bx, yb1, bz],
              [ax, ya1, az],
            ],
            [
              [ua, ya0 / TEX_SCALE],
              [ub, yb0 / TEX_SCALE],
              [ub, yb1 / TEX_SCALE],
              [ua, ya1 / TEX_SCALE],
            ],
            side.n,
            side.shade * light,
          );
        };
        if (!nb || nb.solid) {
          const wallMat = nb ? nb.wallMat : cell.wallMat;
          wall(wallMat, fa, fb, cell.ceil, cell.ceil);
          continue;
        }
        const nfa = floorAt(grid, nb, ncx, ncz, ax, az);
        const nfb = floorAt(grid, nb, ncx, ncz, bx, bz);
        if (nfa > fa + 1e-4 || nfb > fb + 1e-4) wall(stepMat(nb, cell), fa, fb, Math.max(nfa, fa), Math.max(nfb, fb));
        if (nb.ceil < cell.ceil - 1e-4) wall(cell.wallMat, nb.ceil, nb.ceil, cell.ceil, cell.ceil);
      }
    }
  }
  return mb.build();
}

/** Step faces belong to the higher cell visually, so use its wall material. */
function stepMat(higher: Cell, _lower: Cell): string {
  return higher.wallMat;
}
