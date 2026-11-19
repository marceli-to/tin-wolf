import * as THREE from 'three';

/**
 * What a shot leaves behind once the flash is out: smoke from the barrel, a tracer streak toward the hit
 * (SMG and sniper), and brass casings thrown from the gun in first person.
 * Purely visual; uses Math.random, never the sim RNG.
 */

interface SmokeStyle {
  /** Puffs per shot. */
  puffs: number;
  /** Puff diameter when it has spread out (metres). */
  size: number;
  /** Peak opacity of a puff. */
  opacity: number;
  /** Heat a shot adds to the barrel; enough of it leaves a trail rising after the shooting stops. */
  heat: number;
}

const SMOKE_STYLES: Record<string, SmokeStyle> = {
  pistol: { puffs: 2, size: 0.34, opacity: 0.5, heat: 0.6 },
  pistol_sd: { puffs: 2, size: 0.3, opacity: 0.55, heat: 0.6 },
  smg: { puffs: 1, size: 0.28, opacity: 0.4, heat: 1 },
  sniper: { puffs: 4, size: 0.55, opacity: 0.55, heat: 3.2 },
  pelican: { puffs: 5, size: 0.6, opacity: 0.5, heat: 3.2 },
};

interface TracerStyle {
  /** Metres per second the streak flies. */
  speed: number;
  /** Streak length (metres). */
  length: number;
  /** Streak width (metres). */
  width: number;
  opacity: number;
  /** Seconds a faint line stays along the whole path after the streak (0 for none). */
  linger: number;
  color: string;
}

/** Only these guns draw tracers. */
const TRACER_STYLES: Record<string, TracerStyle> = {
  smg: { speed: 230, length: 5, width: 0.035, opacity: 0.45, linger: 0, color: '#ffd890' },
  sniper: { speed: 420, length: 11, width: 0.05, opacity: 0.7, linger: 0.35, color: '#fff0c8' },
};

/** Casing size (metres, length of the brass) per gun; guns not listed eject none. */
const CASING_SIZES: Record<string, number> = { pistol: 0.022, pistol_sd: 0.022, smg: 0.024, sniper: 0.045 };

export function hasTracer(weaponId: string): boolean {
  return weaponId in TRACER_STYLES;
}

/** Heat that starts a trail once the barrel goes quiet (about four SMG rounds, or one sniper shot). */
const TRAIL_HEAT = 3;
/** Barrel heat lost per second. */
const HEAT_DECAY = 1.6;
/** Seconds without a shot before the trail starts rising. */
const TRAIL_WAIT = 0.12;
/** Seconds between trail wisps. */
const WISP_EVERY = 0.045;

const SMOKE_MAX = 140;
const TRACER_MAX = 24;
const CASING_MAX = 24;
const GRAVITY = 9.8;

let puffTex: THREE.Texture | null | undefined;
let streakTex: THREE.Texture | null | undefined;

/** A soft, lumpy grey cloud. */
function puffTexture(): THREE.Texture | null {
  if (puffTex !== undefined) return puffTex;
  if (typeof document === 'undefined') return (puffTex = null);
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const blobs: [number, number, number][] = [
    [0.5, 0.5, 0.34],
    [0.36, 0.42, 0.22],
    [0.64, 0.4, 0.2],
    [0.42, 0.64, 0.2],
    [0.62, 0.62, 0.22],
  ];
  for (const [bx, by, br] of blobs) {
    const r = g.createRadialGradient(bx * S, by * S, 0, bx * S, by * S, br * S);
    r.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    r.addColorStop(0.6, 'rgba(255, 255, 255, 0.25)');
    r.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = r;
    g.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (puffTex = t);
}

/** Across the width: bright in the middle, soft edges. Along the length (v): faint tail (0) to hot head (1). */
function streakTexture(): THREE.Texture | null {
  if (streakTex !== undefined) return streakTex;
  if (typeof document === 'undefined') return (streakTex = null);
  const W = 16;
  const H = 64;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const across = g.createLinearGradient(0, 0, W, 0);
  across.addColorStop(0, 'rgba(255, 255, 255, 0)');
  across.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
  across.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = across;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-in';
  const along = g.createLinearGradient(0, H, 0, 0);
  along.addColorStop(0, 'rgba(0, 0, 0, 0)');
  along.addColorStop(0.7, 'rgba(0, 0, 0, 0.6)');
  along.addColorStop(1, 'rgba(0, 0, 0, 1)');
  g.fillStyle = along;
  g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (streakTex = t);
}

/** Two crossed unit planes from the origin along +Z (v runs 0 → 1 with z), scaled per streak. */
function streakGeometry(): THREE.BufferGeometry {
  const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2);
  const b = a.clone().rotateZ(Math.PI / 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...a.getAttribute('position').array, ...b.getAttribute('position').array], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([...a.getAttribute('uv').array, ...b.getAttribute('uv').array], 2));
  const idx = [...(a.index!.array as ArrayLike<number> & Iterable<number>)];
  geo.setIndex([...idx, ...idx.map((i) => i + 4)]);
  return geo;
}

/** One gun's barrel as seen in one view: how hot it is, and whether a trail is still rising from it. */
export class Barrel {
  heat = 0;
  idle = Infinity;
  trail = 0;
  wisp = 0;
}

interface Puff {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  vel: THREE.Vector3;
  age: number;
  life: number;
  size0: number;
  size1: number;
  opacity: number;
  spin: number;
}

interface Tracer {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  line: THREE.Mesh;
  lineMat: THREE.MeshBasicMaterial;
  from: THREE.Vector3;
  dir: THREE.Vector3;
  dist: number;
  age: number;
  style: TracerStyle;
}

interface Casing {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const _v = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Smoke and tracers in the world scene. Each piece is drawn on a layer, so a shooter's own view can differ. */
export class ShotFx {
  readonly group = new THREE.Group();
  private puffs: Puff[] = [];
  private nextPuff = 0;
  private tracers: Tracer[] = [];
  private nextTracer = 0;

  constructor() {
    const tex = puffTexture();
    for (let i = 0; i < SMOKE_MAX; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: '#e2ded6', transparent: true, depthWrite: false, opacity: 0 });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 5;
      this.group.add(sprite);
      this.puffs.push({ sprite, mat, vel: new THREE.Vector3(), age: 0, life: 0, size0: 0, size1: 0, opacity: 0, spin: 0 });
    }
    const geo = streakGeometry();
    const stex = streakTexture();
    for (let i = 0; i < TRACER_MAX; i++) {
      const common = { map: stex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false } as const;
      const mat = new THREE.MeshBasicMaterial(common);
      const lineMat = new THREE.MeshBasicMaterial({ ...common, map: null });
      const mesh = new THREE.Mesh(geo, mat);
      const line = new THREE.Mesh(geo, lineMat);
      mesh.visible = line.visible = false;
      mesh.renderOrder = line.renderOrder = 9;
      this.group.add(mesh, line);
      this.tracers.push({ mesh, mat, line, lineMat, from: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 0, age: Infinity, style: TRACER_STYLES.smg! });
    }
  }

  clear(): void {
    for (const p of this.puffs) {
      p.age = p.life = 0;
      p.sprite.visible = false;
    }
    for (const t of this.tracers) {
      t.age = Infinity;
      t.mesh.visible = t.line.visible = false;
    }
  }

  private puff(pos: THREE.Vector3, vel: THREE.Vector3, life: number, size0: number, size1: number, opacity: number, layer: number): void {
    const p = this.puffs[this.nextPuff]!;
    this.nextPuff = (this.nextPuff + 1) % SMOKE_MAX;
    p.sprite.position.copy(pos);
    p.sprite.layers.set(layer);
    p.vel.copy(vel);
    p.age = 0;
    p.life = life;
    p.size0 = size0;
    p.size1 = size1;
    p.opacity = opacity;
    p.spin = (Math.random() - 0.5) * 1.5;
    p.mat.rotation = Math.random() * Math.PI * 2;
    p.sprite.visible = true;
  }

  /** A shot from a barrel at `pos` pointing along `dir` (world): a puff blown forward, and heat. */
  shot(barrel: Barrel, pos: THREE.Vector3, dir: THREE.Vector3, weaponId: string, layer: number, scale = 1): void {
    const s = SMOKE_STYLES[weaponId] ?? SMOKE_STYLES.pistol!;
    barrel.heat += s.heat;
    barrel.idle = 0;
    barrel.trail = 0;
    for (let i = 0; i < s.puffs; i++) {
      const push = 0.6 + Math.random() * 1.2 + i * 0.4;
      _v.copy(dir).multiplyScalar(push);
      _v.x += (Math.random() - 0.5) * 0.3;
      _v.y += 0.15 + Math.random() * 0.2;
      _v.z += (Math.random() - 0.5) * 0.3;
      const size = s.size * scale * (0.8 + Math.random() * 0.4);
      _p.copy(pos).addScaledVector(dir, size * 0.25);
      this.puff(_p, _v, 0.7 + Math.random() * 0.5, size * 0.3, size, s.opacity, layer);
    }
  }

  /**
   * Each frame per barrel: cools it, and once the shooting stops on a hot barrel, sends a thin wisp up
   * from `pos` for a while. `show` false (dead, gun put away) stops the trail.
   */
  tick(barrel: Barrel, pos: THREE.Vector3, dt: number, layer: number, show: boolean, scale = 1): void {
    barrel.idle += dt;
    if (barrel.idle > TRAIL_WAIT && barrel.heat >= TRAIL_HEAT) {
      barrel.trail = Math.min(1.6, 0.25 * barrel.heat);
      barrel.heat = 0;
    }
    barrel.heat = Math.max(0, barrel.heat - HEAT_DECAY * dt);
    if (barrel.trail <= 0) return;
    barrel.trail -= dt;
    if (!show) {
      barrel.trail = 0;
      return;
    }
    barrel.wisp -= dt;
    if (barrel.wisp > 0) return;
    barrel.wisp = WISP_EVERY;
    const fade = Math.min(1, barrel.trail / 0.6);
    _v.set((Math.random() - 0.5) * 0.08, 0.35 + Math.random() * 0.2, (Math.random() - 0.5) * 0.08);
    this.puff(pos, _v, 0.7 + Math.random() * 0.4, 0.05 * scale, 0.3 * scale, 0.4 * fade, layer);
  }

  /** A tracer from `from` toward `to` (world), for guns that draw one. */
  tracer(from: THREE.Vector3, to: THREE.Vector3, weaponId: string, layer: number): void {
    const style = TRACER_STYLES[weaponId];
    if (!style) return;
    const dist = from.distanceTo(to);
    if (dist < 0.5) return;
    const t = this.tracers[this.nextTracer]!;
    this.nextTracer = (this.nextTracer + 1) % TRACER_MAX;
    t.from.copy(from);
    t.dir.subVectors(to, from).normalize();
    t.dist = dist;
    t.age = 0;
    t.style = style;
    t.mat.color.set(style.color);
    t.lineMat.color.set(style.color);
    for (const m of [t.mesh, t.line]) {
      m.quaternion.setFromUnitVectors(Z, t.dir);
      m.rotateZ(Math.random() * Math.PI);
      m.layers.set(layer);
    }
    t.line.position.copy(from);
    t.line.scale.set(style.width * 0.5, style.width * 0.5, dist);
  }

  update(dt: number): void {
    for (const p of this.puffs) {
      if (!p.sprite.visible) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.sprite.visible = false;
        continue;
      }
      // The push from the barrel dies away fast; the smoke keeps rising slowly.
      const drag = Math.exp(-4 * dt);
      p.vel.x *= drag;
      p.vel.z *= drag;
      p.vel.y = p.vel.y * drag + 0.35 * (1 - drag);
      p.sprite.position.addScaledVector(p.vel, dt);
      const s = p.size0 + (p.size1 - p.size0) * (1 - (1 - t) * (1 - t));
      p.sprite.scale.set(s, s, 1);
      p.mat.rotation += p.spin * dt;
      p.mat.opacity = p.opacity * Math.min(1, p.age / 0.03) * (1 - t);
    }
    for (const tr of this.tracers) {
      if (tr.age === Infinity) continue;
      tr.age += dt;
      const st = tr.style;
      // The streak runs from its tail to its head, both clipped to the path; it is gone once the tail arrives.
      const front = st.length * 0.6 + st.speed * tr.age;
      const head = Math.min(tr.dist, front);
      const tail = Math.max(0, front - st.length);
      const flying = tail < tr.dist - 0.05;
      tr.mesh.visible = flying;
      if (flying) {
        tr.mesh.position.copy(tr.from).addScaledVector(tr.dir, tail);
        tr.mesh.scale.set(st.width, st.width, head - tail);
        tr.mat.opacity = st.opacity;
      }
      const lingerT = st.linger > 0 ? tr.age / st.linger : 1;
      tr.line.visible = lingerT < 1;
      if (tr.line.visible) tr.lineMat.opacity = st.opacity * 0.22 * (1 - lingerT) * (1 - lingerT);
      if (!flying && lingerT >= 1) tr.age = Infinity;
    }
  }
}

/** Brass casings thrown from the gun in first person; they live in the camera-fixed view-model holder. */
export class Casings {
  private casings: Casing[] = [];
  private next = 0;
  private geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 7).rotateZ(Math.PI / 2);
  private mat = new THREE.MeshStandardMaterial({ color: '#d9a640', metalness: 0.55, roughness: 0.35, emissive: '#3a2608' });

  /**
   * One casing thrown out to the right of the gun. `port` and `dir` (the barrel) are in `holder`'s space,
   * which follows the camera.
   */
  eject(holder: THREE.Object3D, port: THREE.Vector3, dir: THREE.Vector3, weaponId: string, layer: number): void {
    const len = CASING_SIZES[weaponId];
    if (!len) return;
    let c = this.casings[this.next];
    if (!c) {
      c = { mesh: new THREE.Mesh(this.geo, this.mat), vel: new THREE.Vector3(), spin: new THREE.Vector3(), age: Infinity };
      this.casings[this.next] = c;
    }
    this.next = (this.next + 1) % CASING_MAX;
    if (c.mesh.parent !== holder) holder.add(c.mesh);
    c.mesh.layers.set(layer);
    c.mesh.scale.set(len, len * 0.42, len * 0.42);
    c.mesh.position.copy(port);
    c.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    // Out to the right and up, a little back toward the shooter.
    const right = _v.crossVectors(dir, UP).normalize();
    c.vel.copy(right).multiplyScalar(1.4 + Math.random() * 0.8).addScaledVector(UP, 1.2 + Math.random() * 0.6).addScaledVector(dir, -0.3 - Math.random() * 0.3);
    c.spin.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 15 + Math.random() * 15);
    c.age = 0;
    c.mesh.visible = true;
  }

  update(dt: number): void {
    for (const c of this.casings) {
      if (!c || c.age === Infinity) continue;
      c.age += dt;
      if (c.age > 0.7) {
        c.age = Infinity;
        c.mesh.visible = false;
        continue;
      }
      c.vel.y -= GRAVITY * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      c.mesh.rotation.z += c.spin.z * dt;
    }
  }

  clear(): void {
    for (const c of this.casings) c?.mesh.removeFromParent();
    this.casings = [];
    this.next = 0;
  }
}
