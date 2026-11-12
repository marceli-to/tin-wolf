import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { manageTexture } from './textures';

export interface ModelInstance {
  object: THREE.Object3D;
  animations: THREE.AnimationClip[];
  /** Cloned materials of this instance with their original colours, for light tinting. */
  materials: THREE.MeshStandardMaterial[];
}

/** Loads glTF models once and hands out independent clones (skinned meshes included). */
export class ModelLibrary {
  private loaded = new Map<string, GLTF>();
  private loader = new GLTFLoader();

  constructor(private base: string) {}

  async load(paths: readonly string[]): Promise<void> {
    await Promise.all(
      [...new Set(paths)].map(async (p) => {
        if (this.loaded.has(p)) return;
        const gltf = await this.loader.loadAsync(this.base + p);
        this.loaded.set(p, gltf);
      }),
    );
  }

  has(path: string): boolean {
    return this.loaded.has(path);
  }

  instance(path: string): ModelInstance | null {
    const gltf = this.loaded.get(path);
    if (!gltf) return null;
    const object = cloneSkinned(gltf.scene);
    const materials: THREE.MeshStandardMaterial[] = [];
    object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = mats.map((m) => {
        const c = (m as THREE.MeshStandardMaterial).clone();
        c.userData.base = c.color.clone();
        // Model textures follow the global smooth/retro filter mode.
        if (c.map) manageTexture(c.map);
        materials.push(c);
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!;
      // Skinned meshes move away from their bind-pose bounds, so never cull them; static props can be culled.
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
    });
    return { object, animations: gltf.animations, materials };
  }
}

export function tintModel(materials: readonly THREE.MeshStandardMaterial[], light: number): void {
  for (const m of materials) {
    const base = m.userData.base as THREE.Color | undefined;
    if (base) m.color.copy(base).multiplyScalar(light);
  }
}

/** Height of an object's bounding box in its own units (skinned meshes measured in bind pose). */
export function measureHeight(o: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(o, true);
  return box.max.y - box.min.y;
}
