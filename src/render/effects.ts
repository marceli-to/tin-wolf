import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
}

const MAX_PARTICLES = 160;
const MAX_DECALS = 80;

const SURFACE_COLORS: Record<string, string[]> = {
  world: ['#a8a49a', '#7e7a72', '#c8c4b8'],
  flesh: ['#8a1a14', '#b0281e', '#601010'],
  prop: ['#ffd27a', '#ffb040', '#fff0c0'],
};

/** Impact puffs and bullet holes. Purely visual; uses Math.random, never the sim RNG. */
export class Effects {
  readonly group = new THREE.Group();
  private particles: Particle[] = [];
  private free: Particle[] = [];
  private decals: THREE.Mesh[] = [];
  private decalIndex = 0;
  private boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private decalGeo = new THREE.PlaneGeometry(0.12, 0.12);
  private decalMat = new THREE.MeshBasicMaterial({
    color: '#141414',
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  private mats = new Map<string, THREE.MeshBasicMaterial>();

  private mat(color: string): THREE.MeshBasicMaterial {
    let m = this.mats.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color });
      this.mats.set(color, m);
    }
    return m;
  }

  impact(x: number, y: number, z: number, nx: number, ny: number, nz: number, surface: 'world' | 'flesh' | 'prop'): void {
    const colors = SURFACE_COLORS[surface] ?? SURFACE_COLORS.world!;
    const n = surface === 'flesh' ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const color = colors[i % colors.length]!;
      const speed = 1 + Math.random() * 2.5;
      this.spawn(x + nx * 0.02, y + ny * 0.02, z + nz * 0.02, nx * speed + (Math.random() - 0.5) * 2, ny * speed + Math.random() * 1.5, nz * speed + (Math.random() - 0.5) * 2, 0.25 + Math.random() * 0.2, 0.04 + Math.random() * 0.04, color);
    }
    if (surface === 'world') this.decal(x, y, z, nx, ny, nz);
  }

  burst(x: number, y: number, z: number, color: string, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - u * u);
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, z, Math.cos(a) * r * s, Math.abs(u) * s + 1, Math.sin(a) * r * s, 0.6 + Math.random() * 0.5, 0.08 + Math.random() * 0.1, color);
    }
  }

  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: string): void {
    let p = this.free.pop();
    if (!p) {
      if (this.particles.length >= MAX_PARTICLES) return;
      p = { mesh: new THREE.Mesh(this.boxGeo, this.mat(color)), vx: 0, vy: 0, vz: 0, life: 0, max: 0, size: 0 };
      this.group.add(p.mesh);
    }
    p.mesh.material = this.mat(color);
    p.mesh.position.set(x, y, z);
    p.mesh.visible = true;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = life;
    p.max = life;
    p.size = size;
    this.particles.push(p);
  }

  private decal(x: number, y: number, z: number, nx: number, ny: number, nz: number): void {
    let d = this.decals[this.decalIndex];
    if (!d) {
      d = new THREE.Mesh(this.decalGeo, this.decalMat);
      this.decals[this.decalIndex] = d;
      this.group.add(d);
    }
    this.decalIndex = (this.decalIndex + 1) % MAX_DECALS;
    d.position.set(x + nx * 0.005, y + ny * 0.005, z + nz * 0.005);
    d.lookAt(x + nx, y + ny, z + nz);
    d.rotation.z = Math.random() * Math.PI;
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.particles.splice(i, 1);
        this.free.push(p);
        continue;
      }
      p.vy -= 9 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const s = p.size * (0.5 + 0.5 * (p.life / p.max));
      p.mesh.scale.setScalar(s);
    }
  }

  clear(): void {
    for (const p of this.particles) p.mesh.visible = false;
    this.free.push(...this.particles);
    this.particles = [];
    for (const d of this.decals) d.visible = false;
    this.decals.forEach((d) => this.group.remove(d));
    this.decals = [];
    this.decalIndex = 0;
  }
}
