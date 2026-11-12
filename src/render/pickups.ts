import * as THREE from 'three';
import type { ItemDef } from '../data/schema';
import { flatMaterial, shadedBox } from './shapes';

/** Small, readable pickup models built from boxes. */
export function buildPickupMesh(item: ItemDef): THREE.Group {
  const g = new THREE.Group();
  switch (item.kind) {
    case 'health': {
      const box = new THREE.Mesh(shadedBox(0.36, 0.22, 0.26), flatMaterial(item.color));
      const red = flatMaterial('#c8281e');
      const a = new THREE.Mesh(shadedBox(0.2, 0.06, 0.27), red);
      const b = new THREE.Mesh(shadedBox(0.06, 0.2, 0.27), red);
      g.add(box, a, b);
      break;
    }
    case 'ammo': {
      const box = new THREE.Mesh(shadedBox(0.3, 0.18, 0.2), flatMaterial('#4a5a3a'));
      const band = new THREE.Mesh(shadedBox(0.31, 0.05, 0.21), flatMaterial(item.color));
      g.add(box, band);
      break;
    }
    case 'armor': {
      const body = new THREE.Mesh(shadedBox(0.4, 0.46, 0.14), flatMaterial(item.color));
      const neck = new THREE.Mesh(shadedBox(0.16, 0.1, 0.15), flatMaterial('#22303e'));
      neck.position.y = 0.2;
      g.add(body, neck);
      break;
    }
    case 'key': {
      const card = new THREE.Mesh(shadedBox(0.26, 0.02, 0.17), flatMaterial(item.color));
      const strip = new THREE.Mesh(shadedBox(0.26, 0.022, 0.04), flatMaterial('#111'));
      strip.position.z = -0.04;
      g.add(card, strip);
      g.rotation.x = -0.5;
      break;
    }
  }
  return g;
}
