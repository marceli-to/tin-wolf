import * as THREE from 'three';

/**
 * Muzzle flashes: a star-burst facing the camera plus a flame tongue along the barrel, sized per weapon,
 * swelling and fading over a few frames; and the brief warm light a shot throws on the room.
 * Purely visual; uses Math.random, never the sim RNG.
 */

export interface MuzzleStyle {
  /** Star-burst diameter (metres). */
  size: number;
  /** Flame tongue length along the barrel (metres); 0 for none. */
  length: number;
  /** How hard the shot lights the room, 0..2. */
  light: number;
  /** Shot-to-shot size variation, 0..1. */
  jitter: number;
  color: string;
}

export const MUZZLE_STYLES: Record<string, MuzzleStyle> = {
  pistol: { size: 0.34, length: 0.3, light: 1, jitter: 0.25, color: '#ffd9a0' },
  // Suppressed: a faint grey-gold puff, almost no light (its noise radius is 4 m, against the pistol's 25 m).
  pistol_sd: { size: 0.1, length: 0.06, light: 0.12, jitter: 0.2, color: '#8c7f6a' },
  smg: { size: 0.3, length: 0.3, light: 0.75, jitter: 0.45, color: '#ffd090' },
  sniper: { size: 0.55, length: 0.7, light: 1.7, jitter: 0.15, color: '#ffe2b0' },
  // A wide, soft orange bloom from the nozzle and hardly any tongue: a lob, not a bang.
  pelican: { size: 0.5, length: 0.12, light: 0.9, jitter: 0.2, color: '#ffb060' },
};
const DEFAULT_STYLE = MUZZLE_STYLES.pistol!;

export function muzzleStyle(weaponId: string): MuzzleStyle {
  return MUZZLE_STYLES[weaponId] ?? DEFAULT_STYLE;
}

/** Size of flashes on figures in the world, against the styles' first-person sizes. */
const WORLD_FLASH_SCALE = 1.5;
/** Seconds a flash stays on screen (about three frames at 60 fps). */
const FLASH_LIFE = 0.055;
/** Seconds the room stays lit after a shot. */
const LIGHT_LIFE = 0.07;
const FORWARD = new THREE.Vector3(0, 0, -1);

let burstTex: THREE.Texture | null | undefined;
let tongueTex: THREE.Texture | null | undefined;

/** White-hot core with uneven spikes, fading through gold to orange. Drawn once, shared by every flash. */
function burstTexture(): THREE.Texture | null {
  if (burstTex !== undefined) return burstTex;
  if (typeof document === 'undefined') return (burstTex = null);
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const m = S / 2;
  g.globalCompositeOperation = 'lighter';
  const spikes = 9;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 + (i % 2) * 0.17;
    const len = m * (i % 3 === 0 ? 0.98 : i % 3 === 1 ? 0.7 : 0.55);
    const w = i % 3 === 0 ? 0.13 : 0.2;
    const r = g.createRadialGradient(m, m, 0, m, m, len);
    r.addColorStop(0, 'rgba(255, 250, 230, 0.95)');
    r.addColorStop(0.35, 'rgba(255, 200, 110, 0.7)');
    r.addColorStop(0.75, 'rgba(255, 120, 40, 0.25)');
    r.addColorStop(1, 'rgba(255, 90, 20, 0)');
    g.fillStyle = r;
    g.beginPath();
    g.moveTo(m + Math.cos(a - w) * m * 0.12, m + Math.sin(a - w) * m * 0.12);
    g.lineTo(m + Math.cos(a) * len, m + Math.sin(a) * len);
    g.lineTo(m + Math.cos(a + w) * m * 0.12, m + Math.sin(a + w) * m * 0.12);
    g.closePath();
    g.fill();
  }
  const core = g.createRadialGradient(m, m, 0, m, m, m * 0.5);
  core.addColorStop(0, 'rgba(255, 255, 255, 1)');
  core.addColorStop(0.3, 'rgba(255, 245, 200, 0.95)');
  core.addColorStop(0.6, 'rgba(255, 180, 80, 0.45)');
  core.addColorStop(1, 'rgba(255, 110, 30, 0)');
  g.fillStyle = core;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (burstTex = t);
}

/** A flame tongue seen from the side: wide and hot at the bottom (the muzzle), tapering to a tip at the top. */
function tongueTexture(): THREE.Texture | null {
  if (tongueTex !== undefined) return tongueTex;
  if (typeof document === 'undefined') return (tongueTex = null);
  const W = 64;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const lin = g.createLinearGradient(0, H, 0, 0);
  lin.addColorStop(0, 'rgba(255, 255, 240, 1)');
  lin.addColorStop(0.25, 'rgba(255, 220, 140, 0.9)');
  lin.addColorStop(0.65, 'rgba(255, 140, 50, 0.45)');
  lin.addColorStop(1, 'rgba(255, 90, 20, 0)');
  g.fillStyle = lin;
  g.beginPath();
  g.moveTo(W * 0.5, 0);
  g.quadraticCurveTo(W * 0.62, H * 0.45, W * 0.95, H * 0.62);
  g.quadraticCurveTo(W * 0.7, H * 0.8, W * 0.62, H);
  g.lineTo(W * 0.38, H);
  g.quadraticCurveTo(W * 0.3, H * 0.8, W * 0.05, H * 0.62);
  g.quadraticCurveTo(W * 0.38, H * 0.45, W * 0.5, 0);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (tongueTex = t);
}

let tongueGeo: THREE.BufferGeometry | null = null;
/** Two crossed unit planes from the origin along -Z (scaled to width and length per flash). */
function tongueGeometry(): THREE.BufferGeometry {
  if (tongueGeo) return tongueGeo;
  const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(-Math.PI / 2);
  const b = a.clone().rotateZ(Math.PI / 2);
  const pos = [...(a.getAttribute('position').array as Float32Array), ...(b.getAttribute('position').array as Float32Array)];
  const uv = [...(a.getAttribute('uv').array as Float32Array), ...(b.getAttribute('uv').array as Float32Array)];
  const idx = [...(a.index!.array as ArrayLike<number> & Iterable<number>)];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex([...idx, ...idx.map((i) => i + 4)]);
  return (tongueGeo = geo);
}

/**
 * One gun's flash. `object` goes on the barrel tip; `aim` turns it along the barrel (its -Z), so the
 * tongue shows from the side while the burst always faces the camera.
 */
export class MuzzleFlash {
  readonly object = new THREE.Group();
  private burst: THREE.Sprite;
  private tongue: THREE.Mesh;
  private burstMat: THREE.SpriteMaterial;
  private tongueMat: THREE.MeshBasicMaterial;
  private style = DEFAULT_STYLE;
  private k = 1;
  private hasDir = false;
  /** How brightly the flash lights its gun right now (0 when out), for a light near the view model. */
  glow = 0;

  /**
   * `scale` sizes every flash. Seen on other figures they are drawn larger than life (`WORLD_FLASH_SCALE`),
   * so a shot reads at a few metres even against pale walls; first person passes its own.
   */
  constructor(private scale = WORLD_FLASH_SCALE) {
    const common = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false } as const;
    this.burstMat = new THREE.SpriteMaterial({ map: burstTexture(), ...common });
    this.burst = new THREE.Sprite(this.burstMat);
    this.tongueMat = new THREE.MeshBasicMaterial({ map: tongueTexture(), side: THREE.DoubleSide, ...common });
    this.tongue = new THREE.Mesh(tongueGeometry(), this.tongueMat);
    this.burst.renderOrder = this.tongue.renderOrder = 10;
    this.object.add(this.burst, this.tongue);
    this.object.visible = false;
  }

  /** Barrel direction in the parent's space; null when unknown (the tongue is left out). */
  aim(dir: THREE.Vector3 | null): void {
    this.hasDir = !!dir;
    if (dir) this.object.quaternion.setFromUnitVectors(FORWARD, dir.clone().normalize());
    else this.object.quaternion.identity();
  }

  /** A new shot: picks the weapon's look and a fresh random size and turn. */
  fire(weaponId: string): MuzzleStyle {
    this.style = muzzleStyle(weaponId);
    this.k = 1 + (Math.random() - 0.5) * this.style.jitter;
    this.burstMat.rotation = Math.random() * Math.PI * 2;
    this.tongue.rotation.z = Math.random() * Math.PI;
    this.burstMat.color.set(this.style.color);
    this.tongueMat.color.set(this.style.color);
    return this.style;
  }

  /** Shows the flash `since` seconds after the shot: full at once, then swelling a little as it fades. */
  update(since: number, show: boolean): void {
    const t = since / FLASH_LIFE;
    const on = show && t >= 0 && t < 1;
    this.object.visible = on;
    this.glow = 0;
    if (!on) return;
    const fade = Math.pow(1 - t, 1.5);
    this.glow = fade * this.style.light;
    const s = this.style.size * this.k * this.scale * (0.85 + 0.4 * t);
    this.burst.scale.set(s, s, 1);
    this.burst.position.set(0, 0, this.hasDir ? -s * 0.3 : 0);
    this.burstMat.opacity = fade;
    const len = this.style.length * this.k * this.scale * (0.8 + 0.5 * t);
    this.tongue.visible = this.hasDir && len > 0;
    this.tongue.scale.set(s * 0.45, s * 0.45, len);
    this.tongueMat.opacity = fade * 0.9;
  }
}

/** Shots lighting the room at once (one slot each; the oldest is reused). */
const SLOTS = 4;
const LIGHT_COLOR = new THREE.Color('#ffc880');

/**
 * Uniforms shared by every level material patched with `withMuzzleLight`: per slot the position and reach
 * (xyz, w = radius in metres) and the colour times strength (0 when dark).
 */
const muzzleUniforms = {
  uMuzzlePos: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4(0, -1000, 0, 1)) },
  uMuzzleCol: { value: Array.from({ length: SLOTS }, () => new THREE.Vector3()) },
};

/**
 * The level is unlit (light is baked into vertex colours), so real lights pass it by: this adds the
 * muzzle slots' warm light to a basic material by distance, before fog.
 */
export function withMuzzleLight<M extends THREE.MeshBasicMaterial>(mat: M): M {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uMuzzlePos = muzzleUniforms.uMuzzlePos;
    s.uniforms.uMuzzleCol = muzzleUniforms.uMuzzleCol;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMuzzleWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvMuzzleWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vMuzzleWorld;\nuniform vec4 uMuzzlePos[${SLOTS}];\nuniform vec3 uMuzzleCol[${SLOTS}];`,
      )
      .replace(
        '#include <opaque_fragment>',
        `vec3 muzzleLight = vec3(0.0);
	for (int i = 0; i < ${SLOTS}; i++) {
		float f = max(0.0, 1.0 - distance(vMuzzleWorld, uMuzzlePos[i].xyz) / uMuzzlePos[i].w);
		muzzleLight += uMuzzleCol[i] * f * f;
	}
	outgoingLight += diffuseColor.rgb * muzzleLight;
	#include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => 'muzzle-light';
  return mat;
}

/**
 * The light of recent shots: drives the level uniforms and, for the models (standard materials), a fixed
 * set of point lights, always present so the shaders never recompile when one turns on.
 */
export class MuzzleLights {
  readonly group = new THREE.Group();
  private lights: THREE.PointLight[] = [];
  private slots = Array.from({ length: SLOTS }, () => ({ age: Infinity, strength: 0, pos: new THREE.Vector3() }));

  constructor() {
    for (let i = 0; i < SLOTS; i++) {
      const l = new THREE.PointLight(LIGHT_COLOR, 0, 1, 1);
      this.lights.push(l);
      this.group.add(l);
    }
    this.reset();
  }

  reset(): void {
    for (const s of this.slots) s.age = Infinity;
    this.update(0);
  }

  /** A shot at `pos` (world) with the weapon's light strength. */
  flash(pos: THREE.Vector3, strength: number): void {
    if (strength <= 0) return;
    let slot = this.slots[0]!;
    for (const s of this.slots) if (s.age > slot.age) slot = s;
    slot.age = 0;
    slot.strength = strength;
    slot.pos.copy(pos);
  }

  update(dt: number): void {
    this.slots.forEach((s, i) => {
      s.age += dt;
      const t = s.age / LIGHT_LIFE;
      const f = t < 1 ? (1 - t) * (1 - t) * s.strength : 0;
      const radius = 4 + 4 * s.strength;
      muzzleUniforms.uMuzzlePos.value[i]!.set(s.pos.x, s.pos.y, s.pos.z, radius);
      muzzleUniforms.uMuzzleCol.value[i]!.set(LIGHT_COLOR.r, LIGHT_COLOR.g, LIGHT_COLOR.b).multiplyScalar(f * 2.5);
      const l = this.lights[i]!;
      l.position.copy(s.pos);
      l.distance = radius;
      l.intensity = f * 10;
    });
  }
}
