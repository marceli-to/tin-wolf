import * as THREE from 'three';
import type { ItemDef } from '../data/schema';
import { flatMaterial, shadeByNormal, shadedBox } from './shapes';

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
    case 'powerup':
      buildPowerup(g, item);
      break;
  }
  return g;
}

const mesh = (geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0): THREE.Mesh => {
  const m = new THREE.Mesh(shadeByNormal(geo), flatMaterial(color));
  m.position.set(x, y, z);
  return m;
};

/** Power-ups: a bright toy shape per effect over a glowing ring, so they read as special from afar. */
function buildPowerup(g: THREE.Group, item: ItemDef): void {
  const c = item.color;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.035, 6, 24),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.4;
  ring.name = 'ring';
  g.add(ring);
  switch (item.effect) {
    case 'speed': {
      // A boot with a lightning stripe.
      g.add(mesh(new THREE.BoxGeometry(0.16, 0.28, 0.16), c, -0.04, 0.06, 0));
      g.add(mesh(new THREE.BoxGeometry(0.3, 0.12, 0.17), c, 0.03, -0.12, 0));
      g.add(mesh(new THREE.BoxGeometry(0.32, 0.04, 0.18), '#3d4450', 0.03, -0.19, 0));
      const bolt = mesh(new THREE.BoxGeometry(0.05, 0.22, 0.17), '#ffffff', -0.04, 0.06, 0.005);
      bolt.rotation.z = 0.5;
      g.add(bolt);
      break;
    }
    case 'shield': {
      const bubble = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.24, 2),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, depthWrite: false }),
      );
      g.add(bubble);
      const band = mesh(new THREE.TorusGeometry(0.25, 0.025, 6, 24), '#ffffff');
      band.rotation.x = 0.4;
      g.add(band);
      break;
    }
    case 'damage': {
      // A chunky eight-pointed star.
      const a = mesh(new THREE.BoxGeometry(0.3, 0.3, 0.12), c);
      const b = mesh(new THREE.BoxGeometry(0.3, 0.3, 0.12), c);
      b.rotation.z = Math.PI / 4;
      g.add(a, b, mesh(new THREE.BoxGeometry(0.12, 0.12, 0.14), '#ffd23a'));
      break;
    }
    case 'jump': {
      // A spring with a pad on top.
      for (let i = 0; i < 4; i++) {
        const coil = mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 16), '#c9ced4', 0, -0.2 + i * 0.08, 0);
        coil.rotation.x = Math.PI / 2;
        g.add(coil);
      }
      g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16), c, 0, 0.13, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16), c, 0, -0.26, 0));
      break;
    }
    case 'refill': {
      // A backpack: medkit cross and an ammo band.
      g.add(mesh(new THREE.BoxGeometry(0.3, 0.34, 0.18), c));
      g.add(mesh(new THREE.BoxGeometry(0.26, 0.1, 0.06), c, 0, -0.06, 0.11));
      g.add(mesh(new THREE.BoxGeometry(0.18, 0.18, 0.01), '#ffffff', 0, 0.06, 0.093));
      g.add(mesh(new THREE.BoxGeometry(0.14, 0.04, 0.01), '#d33a2c', 0, 0.06, 0.1));
      g.add(mesh(new THREE.BoxGeometry(0.04, 0.14, 0.01), '#d33a2c', 0, 0.06, 0.1));
      g.add(mesh(new THREE.BoxGeometry(0.31, 0.05, 0.19), '#3d4450', 0, -0.13, 0));
      break;
    }
    case 'shrink': {
      // A potion bottle.
      g.add(mesh(new THREE.SphereGeometry(0.16, 12, 10), c, 0, -0.08, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.14, 10), '#e8e0f4', 0, 0.12, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), '#a0703a', 0, 0.21, 0));
      break;
    }
  }
  // Bigger than ammo and medkits: these are the prize.
  g.scale.setScalar(1.4);
  ring.scale.setScalar(1 / 1.4);
  ring.position.y = -0.4 / 1.4;
}
