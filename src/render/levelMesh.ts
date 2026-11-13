import * as THREE from 'three';
import type { RoofDef } from '../data/schema';
import { cellAt, floorAt, type Cell, type Grid } from '../sim/grid';
import type { LightField } from './lighting';
import { materialColor, SHADE } from './palette';
import { texturedMaterial } from './textures';

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

  constructor(private light: LightField) {}

  /**
   * Quad given counter-clockwise (front side). Each vertex is lit by the baked light field,
   * sampled slightly in front of the face so walls take the light of the room they face.
   */
  quad(mat: string, v: [P, P, P, P], uvs: [number, number][], n: P, shade: number): void {
    const b = this.bucket(mat);
    const lit = v.map((p) => shade * this.light(p[0] + n[0] * 0.3, p[2] + n[2] * 0.3));
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = v[i]!;
      b.pos.push(p[0], p[1], p[2]);
      b.nrm.push(n[0], n[1], n[2]);
      const uv = uvs[i]!;
      b.uv.push(uv[0], uv[1]);
      const l = lit[i]!;
      b.col.push(l, l, l * 0.97);
    }
  }

  /**
   * Quad whose front side is picked from `out` (a direction pointing away from the solid), with the
   * shade and world-space UVs taken from its normal. Repeat the last vertex for a triangle.
   */
  face(mat: string, v: [P, P, P, P], out: P): void {
    const e1 = new THREE.Vector3(v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]);
    const e2 = new THREE.Vector3(v[3][0] - v[0][0], v[3][1] - v[0][1], v[3][2] - v[0][2]);
    if (e2.lengthSq() < 1e-8) e2.set(v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]);
    const n = e1.cross(e2).normalize();
    if (n.x * out[0] + n.y * out[1] + n.z * out[2] < 0) {
      v = [v[0], v[3], v[2], v[1]];
      n.negate();
    }
    const shade = n.y > 0.5 ? SHADE.top : n.y < -0.5 ? SHADE.bottom : Math.abs(n.x) > Math.abs(n.z) ? SHADE.ew : SHADE.ns;
    const uv = (p: P): [number, number] => {
      if (Math.abs(n.y) > 0.5) return [p[0] / TEX_SCALE, -p[2] / TEX_SCALE];
      return [(Math.abs(n.x) > Math.abs(n.z) ? p[2] : p[0]) / TEX_SCALE, p[1] / TEX_SCALE];
    };
    this.quad(mat, v, v.map(uv) as [number, number][], [n.x, n.y, n.z], shade);
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
      const m = texturedMaterial(mat, materialColor(mat));
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
export function buildLevelMesh(grid: Grid, light: LightField, roofs: RoofDef[] = []): THREE.Group {
  const mb = new MeshBuilder(light);
  const s = grid.size;
  /** Eave height of the roof over a cell (Infinity when there is none). */
  const eaveAt = (cx: number, cz: number): number => {
    let e = Infinity;
    for (const r of roofs) {
      const inX = cx >= Math.min(r.from[0], r.to[0]) && cx <= Math.max(r.from[0], r.to[0]);
      const inZ = cz >= Math.min(r.from[1], r.to[1]) && cz <= Math.max(r.from[1], r.to[1]);
      if (inX && inZ) e = Math.min(e, r.eave);
    }
    return e;
  };
  for (let cz = 0; cz < grid.h; cz++) {
    for (let cx = 0; cx < grid.w; cx++) {
      const cell = cellAt(grid, cx, cz)!;
      if (cell.solid) continue;
      const x0 = cx * s;
      const x1 = x0 + s;
      const z0 = cz * s;
      const z1 = z0 + s;
      const fh = (x: number, z: number): number => floorAt(grid, cell, cx, cz, x, z);
      const roofed = eaveAt(cx, cz) < Infinity;
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
        SHADE.top,
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
          SHADE.bottom,
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
            side.shade,
          );
        };
        // Seen from outside, a roofed block's walls stop at the eaves and the roof takes over.
        const top = roofed ? cell.ceil : Math.max(fa, fb, Math.min(cell.ceil, eaveAt(ncx, ncz)));
        if (!nb || nb.solid) {
          // Solid cells take the look of the room they face; an explicit wall look only shows outdoors,
          // so a brick exterior does not leak into the rooms behind it, unless the cell asks to show it
          // inside as well (windows, decorated pillars).
          wall(nb?.wallExplicit && (cell.sky || nb.wallInside) ? nb.wallMat : cell.wallMat, fa, fb, top, top);
          continue;
        }
        const nfa = floorAt(grid, nb, ncx, ncz, ax, az);
        const nfb = floorAt(grid, nb, ncx, ncz, bx, bz);
        if (nfa > fa + 1e-4 || nfb > fb + 1e-4) wall(stepMat(nb, cell), fa, fb, Math.max(nfa, fa), Math.max(nfb, fb));
        if (nb.ceil < top - 1e-4) wall(cell.wallMat, nb.ceil, nb.ceil, top, top);
      }
    }
  }
  for (const r of roofs) buildRoof(mb, grid, r);
  return mb.build();
}

/** Roof thickness (m). */
const ROOF_T = 0.16;

/**
 * Gable roof over a block of cells: two sloped slabs meeting at the ridge, overhanging the walls,
 * and a gable triangle on each end wall. Built in roof space (u along the ridge, v across it).
 */
function buildRoof(mb: MeshBuilder, grid: Grid, r: RoofDef): void {
  const s = grid.size;
  const alongX = r.ridge === 'x';
  const [fx, fz] = r.from;
  const [tx, tz] = r.to;
  const [fu, tu, fv, tv] = alongX ? [fx, tx, fz, tz] : [fz, tz, fx, tx];
  const u0 = Math.min(fu, tu) * s;
  const u1 = (Math.max(fu, tu) + 1) * s;
  const v0 = Math.min(fv, tv) * s;
  const v1 = (Math.max(fv, tv) + 1) * s;
  const vm = (v0 + v1) / 2;
  const k = r.rise / (vm - v0);
  const o = r.overhang;
  const peak = r.eave + r.rise;
  const low = r.eave - o * k;
  const at = (u: number, y: number, v: number): P => (alongX ? [u, y, v] : [v, y, u]);
  const dir = (du: number, dy: number, dv: number): P => (alongX ? [du, dy, dv] : [dv, dy, du]);
  // Each slope: from the eave edge (vEdge) up to the ridge; `side` is -1 for the v0 slope, +1 for v1.
  for (const side of [-1, 1]) {
    const ve = side < 0 ? v0 - o : v1 + o;
    const ua = u0 - o;
    const ub = u1 + o;
    const top: P[] = [at(ua, low, ve), at(ub, low, ve), at(ub, peak, vm), at(ua, peak, vm)];
    const bot: P[] = top.map((p) => [p[0], p[1] - ROOF_T, p[2]]);
    const up = dir(0, 1, side * k);
    mb.face(r.mat, [top[0]!, top[1]!, top[2]!, top[3]!], up);
    mb.face(r.mat, [bot[0]!, bot[1]!, bot[2]!, bot[3]!], [-up[0], -up[1], -up[2]]);
    // Fascia along the eave and up both gable edges.
    mb.face(r.mat, [top[0]!, top[1]!, bot[1]!, bot[0]!], dir(0, 0, side));
    mb.face(r.mat, [top[0]!, top[3]!, bot[3]!, bot[0]!], dir(-1, 0, 0));
    mb.face(r.mat, [top[1]!, top[2]!, bot[2]!, bot[1]!], dir(1, 0, 0));
  }
  // Gable triangles on the end walls, tucked under the roof slabs.
  const corner = cellAt(grid, Math.min(r.from[0], r.to[0]), Math.min(r.from[1], r.to[1]));
  const gable = r.gable ?? corner?.wallMat ?? 'brick';
  for (const [u, du] of [[u0, -1], [u1, 1]] as const) {
    const apex = at(u, peak - ROOF_T, vm);
    mb.face(gable, [at(u, r.eave, v0), at(u, r.eave, v1), apex, apex], dir(du, 0, 0));
  }
}

/** Step faces belong to the higher cell visually, so use its step look. */
function stepMat(higher: Cell, _lower: Cell): string {
  return higher.stepMat;
}
