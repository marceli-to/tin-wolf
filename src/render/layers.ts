import type * as THREE from 'three';

/**
 * Layer 0 is shared. A player's own body lives on BODY+slot so their camera can skip it;
 * their view model lives on VIEWMODEL+slot so only their camera sees it.
 */
export const LAYER = { BODY: 1, VIEWMODEL: 5 } as const;
export const MAX_SLOTS = 4;

export function setLayerDeep(obj: THREE.Object3D, layer: number): void {
  obj.traverse((o) => o.layers.set(layer));
}

export function configureCameraLayers(cam: THREE.Camera, slot: number): void {
  cam.layers.set(0);
  for (let s = 0; s < MAX_SLOTS; s++) {
    if (s !== slot) cam.layers.enable(LAYER.BODY + s);
  }
  cam.layers.enable(LAYER.VIEWMODEL + slot);
}
