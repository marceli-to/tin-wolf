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
/** Scorch marks kept at once; the oldest is reused first. */
const MAX_MARKS = 150;
/** Seconds a scorch glows after the hit, stays, and takes to fade out. */
const MARK_GLOW = 1.0;
const MARK_STAY = 30;
const MARK_FADE = 3;

interface Mark {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  glow: THREE.Mesh;
  glowMat: THREE.MeshBasicMaterial;
  age: number;
}

/** A round scorch: soot-black core, a warm brown ring, soft edge. Drawn once, shared by every mark. */
function scorchTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(14, 12, 10, 1)');
  r.addColorStop(0.32, 'rgba(22, 18, 15, 0.95)');
  r.addColorStop(0.5, 'rgba(70, 52, 38, 0.75)');
  r.addColorStop(0.62, 'rgba(110, 88, 66, 0.45)');
  r.addColorStop(0.8, 'rgba(60, 50, 42, 0.18)');
  r.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The hot rim of a fresh energy hit: bright in the middle, fading out. Tinted per frame as it cools. */
function glowTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255, 255, 255, 1)');
  r.addColorStop(0.35, 'rgba(255, 255, 255, 0.85)');
  r.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
  r.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const GLOW_HOT = new THREE.Color('#ffe08a');
const GLOW_COOL = new THREE.Color('#ff4a12');
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _s = new THREE.Vector3();

const SURFACE_COLORS: Record<string, string[]> = {
  world: ['#a8a49a', '#7e7a72', '#c8c4b8'],
  flesh: ['#8a1a14', '#b0281e', '#601010'],
  prop: ['#ffd27a', '#ffb040', '#fff0c0'],
};

/** Impact puffs and scorch marks. Purely visual; uses Math.random, never the sim RNG. */
export class Effects {
  readonly group = new THREE.Group();
  private particles: Particle[] = [];
  private free: Particle[] = [];
  private marks: Mark[] = [];
  private markIndex = 0;
  private boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private markGeo = new THREE.PlaneGeometry(1, 1);
  private scorchTex = scorchTexture();
  private glowTex = glowTexture();
  private mats = new Map<string, THREE.MeshBasicMaterial>();
  /** Expanding fireballs: one material each so they can fade independently. */
  private balls: { mesh: THREE.Mesh; life: number; max: number; radius: number }[] = [];
  private ballGeo = new THREE.IcosahedronGeometry(1, 2);

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
  }

  /**
   * A scorch mark at a point on a surface, facing along the normal. With a parent (a door, a breakable
   * prop) it rides along and disappears with it; otherwise it stays in the world. It glows orange for a
   * moment, stays MARK_STAY seconds and fades.
   */
  mark(x: number, y: number, z: number, nx: number, ny: number, nz: number, parent: THREE.Object3D | null = null): void {
    let m = this.marks[this.markIndex];
    if (!m) {
      const mat = new THREE.MeshBasicMaterial({ map: this.scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const glowMat = new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      const mesh = new THREE.Mesh(this.markGeo, mat);
      const glow = new THREE.Mesh(this.markGeo, glowMat);
      glow.position.z = 0.003;
      glow.scale.setScalar(0.6);
      mesh.add(glow);
      m = { mesh, mat, glow, glowMat, age: 0 };
      this.marks[this.markIndex] = m;
    }
    this.markIndex = (this.markIndex + 1) % MAX_MARKS;
    const host = parent ?? this.group;
    host.add(m.mesh);
    host.updateMatrixWorld(true);
    _p.set(x + nx * 0.006, y + ny * 0.006, z + nz * 0.006);
    m.mesh.position.copy(host.worldToLocal(_p.clone()));
    _n.set(x + nx, y + ny, z + nz);
    m.mesh.lookAt(_n);
    m.mesh.rotateZ(Math.random() * Math.PI * 2);
    host.getWorldScale(_s);
    m.mesh.scale.setScalar((0.11 + Math.random() * 0.07) / Math.max(1e-3, _s.x));
    m.mesh.visible = true;
    m.age = 0;
    m.mat.opacity = 1;
    m.glow.visible = true;
  }

  /** Takes every mark off a parent (a destroyed prop that may come back clean). */
  dropMarks(parent: THREE.Object3D): void {
    for (const m of this.marks) {
      if (m.mesh.parent !== parent) continue;
      m.mesh.visible = false;
      m.age = MARK_STAY + MARK_FADE;
      this.group.add(m.mesh);
    }
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

  /** Surprise box: a pop of toy-coloured confetti. */
  confetti(x: number, y: number, z: number): void {
    for (const c of ['#ff5a4a', '#ffc93c', '#7ad36b', '#5ec8ff', '#b77cff', '#ffffff']) this.burst(x, y, z, c, 7, 5);
  }

  /** Grenade blast: a fireball that swells and fades, sparks, and grey debris. */
  explosion(x: number, y: number, z: number, radius: number): void {
    let b = this.balls.find((o) => o.life <= 0);
    if (!b) {
      const mat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      b = { mesh: new THREE.Mesh(this.ballGeo, mat), life: 0, max: 0, radius: 0 };
      this.balls.push(b);
      this.group.add(b.mesh);
    }
    b.mesh.position.set(x, y, z);
    b.mesh.visible = true;
    b.life = b.max = 0.45;
    b.radius = radius * 0.45;
    this.burst(x, y, z, '#ffd27a', 22, 9);
    this.burst(x, y, z, '#ff7a2a', 14, 6);
    this.burst(x, y, z, '#5a5650', 18, 5);
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

  update(dt: number): void {
    for (const m of this.marks) {
      if (!m.mesh.visible) continue;
      m.age += dt;
      if (m.glow.visible) {
        const t = m.age / MARK_GLOW;
        if (t >= 1) m.glow.visible = false;
        else {
          m.glowMat.color.copy(GLOW_HOT).lerp(GLOW_COOL, Math.min(1, t * 1.4));
          m.glowMat.opacity = (1 - t) ** 1.5;
        }
      }
      if (m.age > MARK_STAY) {
        const f = 1 - (m.age - MARK_STAY) / MARK_FADE;
        if (f <= 0) m.mesh.visible = false;
        else m.mat.opacity = f;
      }
    }
    for (const b of this.balls) {
      if (b.life <= 0) continue;
      b.life -= dt;
      const t = 1 - Math.max(0, b.life) / b.max;
      b.mesh.scale.setScalar(b.radius * (0.3 + 0.7 * Math.sqrt(t)));
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.9;
      if (b.life <= 0) b.mesh.visible = false;
    }
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
    for (const b of this.balls) {
      b.life = 0;
      b.mesh.visible = false;
    }
    for (const p of this.particles) p.mesh.visible = false;
    this.free.push(...this.particles);
    this.particles = [];
    // Keep the pool (and its materials) for the next level; just take the marks off whatever held them.
    for (const m of this.marks) {
      m.mesh.visible = false;
      m.age = MARK_STAY + MARK_FADE;
      this.group.add(m.mesh);
    }
    this.markIndex = 0;
  }
}
