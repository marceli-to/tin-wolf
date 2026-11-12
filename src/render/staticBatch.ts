import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Collects static model props and merges them into one mesh per (texture, transparency) bucket.
 * Each source material's colour (already tinted for desaturation and baked light) becomes a vertex
 * colour, so hundreds of props cost a handful of draw calls.
 */
export class StaticBatch {
  private buckets = new Map<string, { material: THREE.MeshStandardMaterial; geos: THREE.BufferGeometry[] }>();

  add(root: THREE.Object3D): void {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const flat = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      flat.applyMatrix4(mesh.matrixWorld);
      const groups = flat.groups.length ? flat.groups : [{ start: 0, count: flat.getAttribute('position').count, materialIndex: 0 }];
      for (const g of groups) {
        const src = mats[g.materialIndex ?? 0] as THREE.MeshStandardMaterial | undefined;
        if (!src) continue;
        const part = this.slice(flat, g.start, g.count, src.color);
        const key = `${src.map?.uuid ?? 'none'}|${src.transparent ? 1 : 0}`;
        let b = this.buckets.get(key);
        if (!b) {
          b = {
            material: new THREE.MeshStandardMaterial({
              map: src.map,
              vertexColors: true,
              roughness: src.roughness ?? 1,
              metalness: src.metalness ?? 0,
              transparent: src.transparent,
              opacity: src.opacity,
            }),
            geos: [],
          };
          this.buckets.set(key, b);
        }
        b.geos.push(part);
      }
    });
  }

  /** Copy a vertex range with position / normal / uv and a constant colour attribute. */
  private slice(geo: THREE.BufferGeometry, start: number, count: number, color: THREE.Color): THREE.BufferGeometry {
    const out = new THREE.BufferGeometry();
    const copy = (name: string, size: number, fill = 0): void => {
      const src = geo.getAttribute(name);
      const arr = new Float32Array(count * size);
      if (src) for (let i = 0; i < count; i++) for (let k = 0; k < size; k++) arr[i * size + k] = src.getComponent(start + i, k);
      else arr.fill(fill);
      out.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
    };
    copy('position', 3);
    copy('normal', 3);
    copy('uv', 2);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  }

  build(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'static-props';
    for (const { material, geos } of this.buckets.values()) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      group.add(new THREE.Mesh(merged, material));
    }
    return group;
  }
}
