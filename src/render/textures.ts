import * as THREE from 'three';

/**
 * Procedural pixel textures, drawn once on small canvases and sampled with nearest filtering.
 * Each generator is seeded so the look is stable between runs.
 */

type Paint = (ctx: CanvasRenderingContext2D, size: number, rnd: () => number) => void;

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, rgb: [number, number, number], k = 1): void {
  ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, rgb[0] * k)) | 0},${Math.max(0, Math.min(255, rgb[1] * k)) | 0},${
    Math.max(0, Math.min(255, rgb[2] * k)) | 0
  })`;
  ctx.fillRect(x, y, 1, 1);
}

/** Base colour with per-pixel brightness jitter. */
function noise(ctx: CanvasRenderingContext2D, size: number, rnd: () => number, hex: string, amount: number): void {
  const c = hexToRgb(hex);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) px(ctx, x, y, c, 1 + (rnd() - 0.5) * amount);
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, hex: string, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
}

const PAINTERS: Record<string, Paint> = {
  concrete: (ctx, n, r) => {
    noise(ctx, n, r, '#8e8b83', 0.18);
    for (let i = 0; i < 18; i++) rect(ctx, (r() * n) | 0, (r() * n) | 0, 1, 1, '#5e5b55', 0.7);
    rect(ctx, 0, 0, n, 1, '#6e6b65', 0.6);
  },
  tile: (ctx, n, r) => {
    noise(ctx, n, r, '#b4bab6', 0.08);
    for (let i = 0; i < n; i += n / 4) {
      rect(ctx, i, 0, 1, n, '#80857f');
      rect(ctx, 0, i, n, 1, '#80857f');
    }
  },
  metal: (ctx, n, r) => {
    noise(ctx, n, r, '#6f7980', 0.1);
    for (let y = 2; y < n; y += 6) for (let x = (y / 6) % 2 ? 1 : 4; x < n; x += 6) {
      rect(ctx, x, y, 2, 1, '#9aa4ab');
      rect(ctx, x, y + 1, 2, 1, '#4c5459');
    }
  },
  panel: (ctx, n, r) => {
    noise(ctx, n, r, '#7b8691', 0.08);
    rect(ctx, 0, 0, 1, n, '#5a636c');
    rect(ctx, n / 2, 0, 1, n, '#5a636c');
    rect(ctx, 1, 0, 1, n, '#97a2ac');
    rect(ctx, n / 2 + 1, 0, 1, n, '#97a2ac');
    rect(ctx, 0, (n * 0.62) | 0, n, 2, '#5f6870');
    for (const x of [3, n / 2 + 3, n / 2 - 3, n - 3]) {
      rect(ctx, x, 3, 1, 1, '#c0c8cf');
      rect(ctx, x, n - 4, 1, 1, '#c0c8cf');
    }
  },
  ceiling: (ctx, n, r) => {
    noise(ctx, n, r, '#8a8c8c', 0.06);
    for (let i = 0; i < 40; i++) rect(ctx, (r() * n) | 0, (r() * n) | 0, 1, 1, '#6a6c6c');
    rect(ctx, 0, 0, n, 1, '#5a5c5c');
    rect(ctx, 0, 0, 1, n, '#5a5c5c');
  },
  wood: (ctx, n, r) => {
    noise(ctx, n, r, '#8a6a44', 0.12);
    for (let y = 0; y < n; y += 8) {
      rect(ctx, 0, y, n, 1, '#5a4228');
      for (let i = 0; i < 4; i++) rect(ctx, (r() * n) | 0, y + 2 + ((r() * 5) | 0), 3 + ((r() * 5) | 0), 1, '#74573a');
    }
  },
  snow: (ctx, n, r) => {
    noise(ctx, n, r, '#e4eaee', 0.06);
    for (let i = 0; i < 14; i++) rect(ctx, (r() * n) | 0, (r() * n) | 0, 2, 1, '#c8d2da');
  },
  ice: (ctx, n, r) => {
    noise(ctx, n, r, '#b8d0dc', 0.08);
    for (let i = 0; i < 6; i++) rect(ctx, (r() * n) | 0, (r() * n) | 0, 6, 1, '#e8f4fa', 0.8);
  },
  rock: (ctx, n, r) => {
    noise(ctx, n, r, '#76716b', 0.22);
    for (let i = 0; i < 10; i++) {
      const s = 2 + ((r() * 5) | 0);
      rect(ctx, (r() * n) | 0, (r() * n) | 0, s, s - 1, r() > 0.5 ? '#5e5a55' : '#8c8780', 0.8);
    }
  },
  brick: (ctx, n, r) => {
    noise(ctx, n, r, '#8a5444', 0.14);
    const bh = n / 8;
    for (let row = 0; row < 8; row++) {
      const y = row * bh;
      rect(ctx, 0, y, n, 1, '#b8ab98');
      const off = row % 2 ? n / 8 : 0;
      for (let x = off; x < n + n / 4; x += n / 4) rect(ctx, x % n, y, 1, bh, '#b8ab98');
    }
  },
  grate: (ctx, n, r) => {
    noise(ctx, n, r, '#4a5054', 0.1);
    for (let y = 1; y < n; y += 4) for (let x = 1; x < n; x += 4) rect(ctx, x, y, 2, 2, '#1c1f21');
  },
  crate: (ctx, n, r) => {
    noise(ctx, n, r, '#93703f', 0.12);
    for (let y = 0; y < n; y += 6) rect(ctx, 0, y, n, 1, '#6c5029');
    rect(ctx, 0, 0, n, 3, '#5c4220');
    rect(ctx, 0, n - 3, n, 3, '#5c4220');
    rect(ctx, 0, 0, 3, n, '#5c4220');
    rect(ctx, n - 3, 0, 3, n, '#5c4220');
    for (let i = 0; i < n; i++) rect(ctx, i, i, 2, 1, '#5c4220');
  },
  barrel: (ctx, n, r) => {
    noise(ctx, n, r, '#8a3a2c', 0.1);
    for (const y of [2, n / 2, n - 4]) {
      rect(ctx, 0, y, n, 2, '#5a2018');
      rect(ctx, 0, y + 2, n, 1, '#a8584a');
    }
    rect(ctx, n * 0.3, n * 0.3, n * 0.4, n * 0.15, '#d8c040');
  },
  console: (ctx, n, r) => {
    noise(ctx, n, r, '#38454f', 0.08);
    rect(ctx, 3, 3, n - 6, n / 2 - 4, '#0c1a12');
    for (let y = 5; y < n / 2 - 2; y += 3) rect(ctx, 5, y, ((r() * (n - 12)) | 0) + 3, 1, '#40d070');
    const cols = ['#d84a3a', '#e0b040', '#40a0ff', '#40d070'];
    for (let i = 0; i < 8; i++) rect(ctx, 4 + (i % 4) * ((n - 8) / 4), n / 2 + 4 + Math.floor(i / 4) * 6, 3, 3, cols[i % 4]!);
  },
  door: (ctx, n, r) => {
    noise(ctx, n, r, '#7d6a4c', 0.08);
    rect(ctx, 2, 2, n - 4, n - 4, '#8d7a5c');
    for (let y = 6; y < n; y += 8) rect(ctx, 2, y, n - 4, 1, '#5e4e36');
    rect(ctx, n - 7, n / 2, 3, 2, '#c8c0a8');
  },
  door_red: (ctx, n, r) => {
    noise(ctx, n, r, '#8a3a32', 0.08);
    rect(ctx, 2, 2, n - 4, n - 4, '#9a4a40');
    for (let x = 0; x < n; x += 4) rect(ctx, x, n - 6, 2, 4, x % 8 ? '#1a1a1a' : '#e0c040');
    rect(ctx, n / 2 - 4, n / 3, 8, 5, '#d8d0c0');
    rect(ctx, n / 2 - 3, n / 3 + 1, 6, 3, '#c8281e');
  },
  hazard: (ctx, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) px(ctx, x, y, ((x + y) >> 2) % 2 ? [30, 30, 30] : [214, 172, 52]);
  },
  carpet: (ctx, n, r) => {
    noise(ctx, n, r, '#5a3a3a', 0.16);
  },
};

const cache = new Map<string, THREE.Texture>();

export function hasTexture(name: string): boolean {
  return name in PAINTERS;
}

export function getTexture(name: string): THREE.Texture | null {
  const paint = PAINTERS[name];
  if (!paint) return null;
  let t = cache.get(name);
  if (t) return t;
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  let seed = 7;
  for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  paint(ctx, size, seeded(seed));
  t = new THREE.CanvasTexture(canvas);
  // Nearest up close for the pixel look; nearest mipmaps far away so walls do not shimmer.
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.generateMipmaps = true;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(name, t);
  return t;
}

/** Textured, vertex-lit material; falls back to a flat colour for unknown names. */
export function texturedMaterial(name: string, fallback: string): THREE.MeshBasicMaterial {
  const map = getTexture(name);
  return map ? new THREE.MeshBasicMaterial({ map, vertexColors: true }) : new THREE.MeshBasicMaterial({ color: fallback, vertexColors: true });
}
