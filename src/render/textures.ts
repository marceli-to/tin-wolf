import * as THREE from 'three';

/**
 * Procedural pixel textures, drawn once on small canvases and sampled with nearest filtering.
 * Each generator is seeded so the look is stable between runs.
 */


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

/** Direct pixel access: painters write into an RGBA buffer, then flush it to the canvas. */
class Pix {
  readonly d: Uint8ClampedArray;
  constructor(
    readonly n: number,
    private img: ImageData,
  ) {
    this.d = img.data;
  }
  set(x: number, y: number, r: number, g: number, b: number): void {
    const n = this.n;
    x = Math.floor(x);
    y = Math.floor(y);
    const i = (((y % n) + n) % n) * n * 4 + (((x % n) + n) % n) * 4;
    this.d[i] = r;
    this.d[i + 1] = g;
    this.d[i + 2] = b;
    this.d[i + 3] = 255;
  }
  /** Multiply the pixel by k (shade). */
  mul(x: number, y: number, k: number): void {
    const n = this.n;
    x = Math.floor(x);
    y = Math.floor(y);
    const i = (((y % n) + n) % n) * n * 4 + (((x % n) + n) % n) * 4;
    this.d[i] = this.d[i]! * k;
    this.d[i + 1] = this.d[i + 1]! * k;
    this.d[i + 2] = this.d[i + 2]! * k;
  }
  fill(x0: number, y0: number, w: number, h: number, hex: string): void {
    const [r, g, b] = hexToRgb(hex);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, r, g, b);
  }
  shade(x0: number, y0: number, w: number, h: number, k: number): void {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.mul(x, y, k);
  }
  flush(ctx: CanvasRenderingContext2D): void {
    ctx.putImageData(this.img, 0, 0);
  }
}

/** Tileable value noise in [0,1] with `cells` cells across, bilinear-smoothed. */
function valueNoise(n: number, cells: number, rnd: () => number): Float32Array {
  const g = new Float32Array(cells * cells).map(() => rnd());
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const fx = (x / n) * cells;
      const fy = (y / n) * cells;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const at = (cx: number, cy: number): number => g[(cy % cells) * cells + (cx % cells)]!;
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      out[y * n + x] = a + (b - a) * sy;
    }
  }
  return out;
}

/** Base colour with large soft blotches (grime) and fine grain. */
function surface(p: Pix, rnd: () => number, hex: string, blotch: number, grain: number, cells = 4): void {
  const [r, g, b] = hexToRgb(hex);
  const low = valueNoise(p.n, cells, rnd);
  const mid = valueNoise(p.n, cells * 4, rnd);
  for (let y = 0; y < p.n; y++) {
    for (let x = 0; x < p.n; x++) {
      const i = y * p.n + x;
      const k = 1 + (low[i]! - 0.5) * blotch + (mid[i]! - 0.5) * blotch * 0.5 + (rnd() - 0.5) * grain;
      p.set(x, y, r * k, g * k, b * k);
    }
  }
}

/** Raised edge: light line on top/left, dark line on bottom/right. */
function bevel(p: Pix, x: number, y: number, w: number, h: number, light = 1.18, dark = 0.72): void {
  p.shade(x, y, w, 1, light);
  p.shade(x, y, 1, h, light);
  p.shade(x, y + h - 1, w, 1, dark);
  p.shade(x + w - 1, y, 1, h, dark);
}

function rivet(p: Pix, x: number, y: number): void {
  p.shade(x, y, 2, 2, 1.35);
  p.shade(x + 1, y + 1, 2, 2, 0.7);
  p.shade(x + 1, y + 1, 1, 1, 1.1);
}

type Paint = (p: Pix, n: number, rnd: () => number) => void;

/** 5×7 pixel glyphs for toy blocks. */
const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
};

function glyph(p: Pix, n: number, ch: string, color: string, u = 12): void {
  const rows = GLYPHS[ch] ?? [];
  const x0 = Math.round((n - 5 * u) / 2);
  const y0 = Math.round((n - 7 * u) / 2);
  rows.forEach((row, gy) => {
    for (let gx = 0; gx < 5; gx++) if (row[gx] === '#') p.fill(x0 + gx * u, y0 + gy * u, u, u, color);
  });
}

/** A toy block face: colour, a white rim and a letter. */
function toyBlock(bg: string, ch: string, fg: string): Paint {
  return (p, n) => {
    p.fill(0, 0, n, n, '#fff8e8');
    p.fill(10, 10, n - 20, n - 20, bg);
    flatPanel(p, 0, 0, n, n, 5);
    flatPanel(p, 10, 10, n - 20, n - 20, 4);
    glyph(p, n, ch, fg);
  };
}

const plain = (color: string, edge = 4): Paint => (p, n) => {
  p.fill(0, 0, n, n, color);
  flatPanel(p, 0, 0, n, n, edge);
};

/**
 * Arena themes (both render styles): space station (Pumphouse), toy factory (Warehouse).
 * One texture spans 2 m of wall or floor.
 */
const THEMED: Record<string, Paint> = {
  surprise: (p, n) => paintSurprise(p, n),
  // ---- space station
  space_wall: (p, n) => {
    p.fill(0, 0, n, n, '#e9eef5');
    flatPanel(p, 0, 0, n / 2, n, 3);
    flatPanel(p, n / 2, 0, n / 2, n, 3);
    p.fill(0, n * 0.62, n, n * 0.1, '#3b82d6');
    p.fill(0, n * 0.62, n, 2, '#8cc4ff');
    p.fill(0, n * 0.9, n, 3, '#c3ccd8');
  },
  space_window: (p, n, r) => {
    p.fill(0, 0, n, n, '#e9eef5');
    p.fill(14, 18, n - 28, n - 36, '#0d1530');
    for (let i = 0; i < 40; i++) {
      const x = 16 + r() * (n - 32);
      const y = 20 + r() * (n - 40);
      p.fill(x, y, r() > 0.8 ? 2 : 1, r() > 0.8 ? 2 : 1, r() > 0.85 ? '#ffe9a0' : '#ffffff');
    }
    flatPanel(p, 0, 0, n, n, 4);
    flatPanel(p, 14, 18, n - 28, n - 36, 3);
    p.fill(n / 2 - 2, 18, 4, n - 36, '#e9eef5');
  },
  space_floor: (p, n) => {
    p.fill(0, 0, n, n, '#4a5670');
    for (const x of [0, n / 2]) for (const y of [0, n / 2]) flatPanel(p, x, y, n / 2, n / 2, 3);
    for (const x of [0, n / 2]) for (const y of [0, n / 2]) p.fill(x + n / 4 - 3, y + n / 4 - 3, 6, 6, '#5fd0f0');
  },
  space_strip: (p, n) => {
    p.fill(0, 0, n, n, '#3c465c');
    flatPanel(p, 0, 0, n, n, 3);
    p.fill(n / 2 - 5, 0, 10, n, '#5fd0f0');
    p.fill(n / 2 - 2, 0, 4, n, '#d8f6ff');
  },
  space_ceil: (p, n) => {
    p.fill(0, 0, n, n, '#cfd8e3');
    flatPanel(p, 0, 0, n, n, 3);
    p.fill(n / 4, n / 4, n / 2, n / 2, '#ffffff');
    flatPanel(p, n / 4, n / 4, n / 2, n / 2, 3);
  },
  space_plate: (p, n) => {
    p.fill(0, 0, n, n, '#9fb3c8');
    for (let y = 8; y < n; y += 16) for (let x = (y / 16) % 2 ? 0 : 8; x < n; x += 16) p.shade(x, y, 6, 3, 1.15);
    flatPanel(p, 0, 0, n, n, 4);
  },
  space_hazard: (p, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const on = ((x + y) >> 4) % 2 === 0;
      p.set(x, y, on ? 95 : 233, on ? 208 : 238, on ? 240 : 245);
    }
  },
  // ---- castle
  castle_stone: (p, n, r) => {
    p.fill(0, 0, n, n, '#857f75');
    const rh = n / 4;
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? n / 4 : 0;
      for (let i = -1; i < 2; i++) {
        const x = off + i * (n / 2);
        const k = 0.9 + r() * 0.18;
        const g = Math.round(0xb3 * k);
        p.fill(x + 2, row * rh + 2, n / 2 - 4, rh - 4, `#${g.toString(16).padStart(2, '0')}${Math.round(0xad * k).toString(16).padStart(2, '0')}${Math.round(0xa2 * k).toString(16).padStart(2, '0')}`);
        flatPanel(p, x + 2, row * rh + 2, n / 2 - 4, rh - 4, 4);
      }
    }
  },
  grass: (p, n, r) => {
    p.fill(0, 0, n, n, '#7cc76a');
    for (let i = 0; i < 260; i++) {
      const x = r() * n;
      const y = r() * n;
      p.fill(x, y, 2, 3, r() > 0.5 ? '#6ab55a' : '#8fd47b');
    }
    for (let i = 0; i < 6; i++) {
      // A few flowers.
      const x = r() * (n - 4);
      const y = r() * (n - 4);
      p.fill(x, y, 4, 4, r() > 0.5 ? '#ffffff' : '#ffd23a');
    }
  },
  castle_floor: (p, n, r) => {
    p.fill(0, 0, n, n, '#8f8778');
    const c = n / 3;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const k = 0.92 + r() * 0.14;
      p.fill(x * c + 2, y * c + 2, c - 4, c - 4, '#cbc3b2');
      p.shade(x * c + 2, y * c + 2, c - 4, c - 4, k);
      flatPanel(p, x * c + 2, y * c + 2, c - 4, c - 4, 3);
    }
  },
  castle_roof: (p, n) => {
    p.fill(0, 0, n, n, '#c9483c');
    const rh = n / 6;
    for (let row = 0; row < 6; row++) {
      const off = row % 2 ? n / 8 : 0;
      for (let x = -n / 4; x < n; x += n / 4) flatPanel(p, x + off, row * rh, n / 4, rh, 3);
    }
  },
  // ---- toy factory
  toy_bricks: (p, n) => {
    const colors = ['#e9453a', '#ffc93c', '#3b82d6', '#3fb56b'];
    const rh = n / 4;
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? n / 4 : 0;
      for (let i = -1; i < 2; i++) {
        const x = off + i * (n / 2);
        const c = colors[(row * 3 + i + 4) % colors.length]!;
        p.fill(x, row * rh, n / 2, rh, c);
        flatPanel(p, x, row * rh, n / 2, rh, 4);
        p.shade(x, row * rh, 2, rh, 0.55);
      }
      p.shade(0, row * rh + rh - 2, n, 2, 0.55);
    }
  },
  toy_wall: (p, n) => {
    p.fill(0, 0, n, n, '#bfe3ff');
    flatPanel(p, 0, 0, n / 2, n, 4);
    flatPanel(p, n / 2, 0, n / 2, n, 4);
    const colors = ['#e9453a', '#ffc93c', '#3fb56b', '#3b82d6'];
    for (let i = 0; i < 4; i++) {
      p.fill(i * (n / 4), n * 0.58, n / 4, n * 0.1, colors[i]!);
      flatPanel(p, i * (n / 4), n * 0.58, n / 4, n * 0.1, 3);
    }
  },
  toy_floor: (p, n) => {
    for (const x of [0, n / 2]) for (const y of [0, n / 2]) {
      p.fill(x, y, n / 2, n / 2, (x + y) % n === 0 ? '#fff4dc' : '#bfe9d9');
      flatPanel(p, x, y, n / 2, n / 2, 3);
    }
  },
  toy_top: (p, n) => {
    p.fill(0, 0, n, n, '#ffc93c');
    for (const x of [0, n / 2]) for (const y of [0, n / 2]) {
      flatPanel(p, x, y, n / 2, n / 2, 4);
      // Studs, like a toy brick seen from above.
      p.fill(x + n / 4 - 10, y + n / 4 - 10, 20, 20, '#ffd95e');
      flatPanel(p, x + n / 4 - 10, y + n / 4 - 10, 20, 20, 3);
    }
  },
  toy_ceil: (p, n) => {
    p.fill(0, 0, n, n, '#cfe8ff');
    flatPanel(p, 0, 0, n, n, 4);
    p.fill(n / 4, n / 4, n / 2, n / 2, '#ffffff');
  },
  toy_plank: (p, n) => {
    p.fill(0, 0, n, n, '#3b82d6');
    for (let y = 0; y < n; y += n / 4) flatPanel(p, 0, y, n, n / 4, 3);
  },
  toy_candy: (p, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const red = ((x + y) >> 4) % 2 === 0;
      p.set(x, y, red ? 233 : 255, red ? 69 : 248, red ? 58 : 232);
    }
  },
  toy_red: plain('#e9453a'),
  toy_yellow: plain('#ffc93c'),
  toy_blue: plain('#3b82d6'),
  block_a: toyBlock('#e9453a', 'A', '#ffc93c'),
  block_b: toyBlock('#3b82d6', 'B', '#ffffff'),
  block_c: toyBlock('#3fb56b', 'C', '#fff8e8'),
  block_1: toyBlock('#ffc93c', '1', '#e9453a'),
};

const PAINTERS: Record<string, Paint> = {
  ...THEMED,
  concrete: (p, n, r) => {
    surface(p, r, '#8f8c84', 0.22, 0.1);
    // Formwork seams and tie holes, as on poured concrete walls.
    p.shade(0, 0, n, 2, 0.8);
    p.shade(0, n / 2, n, 1, 0.88);
    for (const x of [n / 4, (3 * n) / 4]) for (const y of [n / 4, (3 * n) / 4]) {
      p.shade(x - 2, y - 2, 4, 4, 0.6);
      p.shade(x - 1, y - 1, 2, 2, 0.75);
    }
    for (let i = 0; i < 60; i++) p.shade((r() * n) | 0, (r() * n) | 0, 1 + ((r() * 2) | 0), 1, 0.7);
  },
  tile: (p, n, r) => {
    surface(p, r, '#b6bcb8', 0.08, 0.05);
    const t = n / 4;
    for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
      p.shade(tx * t, ty * t, t, t, 0.94 + r() * 0.1);
      bevel(p, tx * t + 2, ty * t + 2, t - 3, t - 3, 1.08, 0.9);
      p.fill(tx * t, ty * t, t, 2, '#7b807a');
      p.fill(tx * t, ty * t, 2, t, '#7b807a');
    }
    for (let i = 0; i < 6; i++) p.shade((r() * n) | 0, (r() * n) | 0, 6, 1, 0.85);
  },
  metal: (p, n, r) => {
    surface(p, r, '#727d84', 0.14, 0.06);
    // Diamond tread plate.
    for (let y = 0; y < n; y += 12) for (let x = (y / 12) % 2 ? 0 : 6; x < n; x += 12) {
      for (let k = 0; k < 5; k++) {
        p.shade(x + k, y + 4 - k, 1, 1, 1.35);
        p.shade(x + k + 1, y + 5 - k, 1, 1, 0.65);
      }
    }
    for (let i = 0; i < 8; i++) {
      const x = (r() * n) | 0;
      const y = (r() * n) | 0;
      const len = 6 + ((r() * 20) | 0);
      for (let k = 0; k < len; k++) p.shade(x + k, y + ((k / 4) | 0), 1, 1, 1.15);
    }
  },
  panel: (p, n, r) => {
    surface(p, r, '#7e8994', 0.12, 0.05);
    const half = n / 2;
    for (const x0 of [0, half]) {
      bevel(p, x0 + 1, 1, half - 2, n - 2, 1.12, 0.78);
      p.shade(x0, 0, 1, n, 0.55);
      for (const y of [6, n - 8]) for (const x of [x0 + 5, x0 + half - 7]) rivet(p, x, y);
    }
    // Horizontal rail.
    const ry = Math.round(n * 0.62);
    p.shade(0, ry, n, 4, 0.82);
    p.shade(0, ry, n, 1, 1.2);
    p.shade(0, ry + 4, n, 1, 0.65);
    // Rust/grime streaks running down from the rail.
    for (let i = 0; i < 10; i++) {
      const x = (r() * n) | 0;
      const len = 6 + ((r() * 24) | 0);
      for (let k = 0; k < len; k++) p.shade(x, ry + 5 + k, 1, 1, 0.9 + k / len / 10);
    }
  },
  ceiling: (p, n, r) => {
    surface(p, r, '#9a9c9a', 0.06, 0.04);
    const t = n / 2;
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      p.shade(tx * t, ty * t, t, t, 0.95 + r() * 0.08);
      for (let y = ty * t + 5; y < ty * t + t - 3; y += 5) for (let x = tx * t + 5; x < tx * t + t - 3; x += 5) if (r() > 0.25) p.shade(x, y, 1, 1, 0.68);
      p.fill(tx * t, ty * t, t, 2, '#c4c6c3');
      p.fill(tx * t, ty * t, 2, t, '#c4c6c3');
      p.shade(tx * t, ty * t + 2, t, 1, 0.8);
    }
  },
  wood: (p, n, r) => {
    surface(p, r, '#8a6a44', 0.1, 0.06, 2);
    const ph = n / 8;
    for (let row = 0; row < 8; row++) {
      const y0 = row * ph;
      p.shade(0, y0, n, ph, 0.88 + r() * 0.22);
      p.fill(0, y0, n, 1, '#4a3420');
      const off = (r() * n) | 0;
      p.shade(off, y0, 1, ph, 0.6);
      for (let g = 0; g < 4; g++) {
        const gy = y0 + 2 + ((r() * (ph - 3)) | 0);
        const ph2 = r() * 6;
        for (let x = 0; x < n; x++) p.shade(x, gy + Math.round(Math.sin(x / 9 + ph2) * 1.2), 1, 1, 0.86);
      }
    }
  },
  snow: (p, n, r) => {
    surface(p, r, '#e6ecf0', 0.07, 0.03, 3);
    for (let i = 0; i < 40; i++) p.shade((r() * n) | 0, (r() * n) | 0, 1, 1, 1.08);
    for (let i = 0; i < 18; i++) p.shade((r() * n) | 0, (r() * n) | 0, 3, 1, 0.93);
  },
  ice: (p, n, r) => {
    surface(p, r, '#b8d0dc', 0.12, 0.04);
    for (let i = 0; i < 10; i++) p.shade((r() * n) | 0, (r() * n) | 0, 14, 1, 1.15);
  },
  rock: (p, n, r) => {
    surface(p, r, '#77726b', 0.4, 0.12, 5);
    for (let i = 0; i < 6; i++) {
      let x = r() * n;
      let y = r() * n;
      for (let k = 0; k < 30; k++) {
        p.shade(x | 0, y | 0, 1, 1, 0.6);
        x += r() * 2 - 0.6;
        y += r() * 2 - 1;
      }
    }
  },
  brick: (p, n, r) => {
    surface(p, r, '#8c5646', 0.12, 0.08);
    const bh = n / 8;
    const bw = n / 4;
    for (let row = 0; row < 8; row++) {
      const y = row * bh;
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < n; x += bw) {
        const bx = x + off;
        p.shade(bx, y, bw, bh, 0.86 + r() * 0.26);
        bevel(p, bx + 2, y + 2, bw - 3, bh - 3, 1.1, 0.82);
        p.fill(bx, y, 2, bh, '#b4a794');
      }
      p.fill(0, y, n, 2, '#b4a794');
    }
  },
  grate: (p, n, r) => {
    surface(p, r, '#4c5256', 0.12, 0.05);
    for (let y = 2; y < n; y += 8) for (let x = 2; x < n; x += 8) {
      p.fill(x, y, 5, 5, '#15181a');
      p.shade(x, y + 5, 5, 1, 1.4);
    }
  },
  crate: (p, n, r) => {
    surface(p, r, '#94713f', 0.12, 0.06, 2);
    const ph = n / 6;
    for (let y = 0; y < n; y += ph) p.fill(0, Math.round(y), n, 2, '#5f4524');
    const b = 12;
    for (const [x, y, w, h] of [
      [0, 0, n, b],
      [0, n - b, n, b],
      [0, 0, b, n],
      [n - b, 0, b, n],
    ] as const) {
      p.fill(x, y, w, h, '#7a5a30');
      bevel(p, x, y, w, h, 1.15, 0.7);
    }
    for (let i = b; i < n - b; i++) p.fill(i, i - 4, 2, 9, '#7a5a30');
    for (const [x, y] of [[4, 4], [n - 7, 4], [4, n - 7], [n - 7, n - 7]] as const) rivet(p, x, y);
  },
  barrel: (p, n, r) => {
    surface(p, r, '#8a3a2c', 0.14, 0.05, 2);
    for (const y of [6, n / 2 - 3, n - 12]) {
      p.shade(0, y, n, 6, 0.75);
      p.shade(0, y, n, 1, 1.3);
    }
    p.fill(n * 0.3, n * 0.28, n * 0.4, n * 0.14, '#d8c040');
    p.fill(n * 0.33, n * 0.31, n * 0.34, n * 0.03, '#2a2a2a');
  },
  console: (p, n, r) => {
    surface(p, r, '#3a4752', 0.08, 0.04);
    bevel(p, 0, 0, n, n, 1.2, 0.6);
    p.fill(8, 8, n - 16, n / 2 - 12, '#08140e');
    bevel(p, 6, 6, n - 12, n / 2 - 8, 0.6, 1.3);
    for (let y = 14; y < n / 2 - 8; y += 6) p.fill(14, y, ((r() * (n - 40)) | 0) + 10, 2, r() > 0.8 ? '#e0b040' : '#40d070');
    const cols = ['#d84a3a', '#e0b040', '#40a0ff', '#40d070'];
    for (let i = 0; i < 12; i++) {
      const x = 12 + (i % 6) * ((n - 24) / 6);
      const y = n / 2 + 10 + Math.floor(i / 6) * 22;
      p.fill(x, y, 10, 10, cols[i % 4]!);
      bevel(p, x, y, 10, 10, 1.3, 0.6);
    }
  },
  door: (p, n, r) => {
    surface(p, r, '#7d6a4c', 0.1, 0.04);
    bevel(p, 6, 6, n - 12, n - 12, 1.15, 0.7);
    for (let y = 22; y < n - 10; y += 26) {
      p.shade(10, y, n - 20, 3, 0.75);
      p.shade(10, y, n - 20, 1, 1.25);
    }
    p.fill(n - 26, n / 2 - 4, 12, 6, '#c8c0a8');
    bevel(p, n - 26, n / 2 - 4, 12, 6, 1.3, 0.6);
  },
  door_red: (p, n, r) => {
    surface(p, r, '#8e3c33', 0.1, 0.04);
    bevel(p, 6, 6, n - 12, n - 12, 1.15, 0.7);
    for (let x = 0; x < n; x += 16) for (let y = n - 22; y < n - 8; y++) for (let k = 0; k < 8; k++) p.set(x + k + (y - (n - 22)), y, 214, 172, 52);
    p.fill(n / 2 - 16, n / 3, 32, 20, '#ddd5c4');
    p.fill(n / 2 - 12, n / 3 + 4, 24, 12, '#c8281e');
  },
  hazard: (p, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const yellow = ((x + y) >> 4) % 2 === 0;
      p.set(x, y, yellow ? 214 : 30, yellow ? 172 : 30, yellow ? 52 : 30);
    }
  },
  alarm: (p, n, r) => {
    surface(p, r, '#8e2f28', 0.12, 0.05);
    bevel(p, 4, 4, n - 8, n - 8, 1.2, 0.7);
    p.fill(n / 2 - 22, n / 2 - 22, 44, 44, '#d8cfb8');
    p.fill(n / 2 - 15, n / 2 - 15, 30, 30, '#e0281e');
    bevel(p, n / 2 - 15, n / 2 - 15, 30, 30, 1.3, 0.6);
  },
  roof: (p, n, r) => {
    surface(p, r, '#56687c', 0.1, 0.06);
    const rh = n / 4;
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? n / 8 : 0;
      for (let x = -n / 4; x < n; x += n / 4) p.shade(x + off, row * rh, n / 4 - 2, rh - 3, 0.9 + r() * 0.2);
      p.shade(0, row * rh + rh - 3, n, 3, 0.7);
    }
  },
  carpet: (p, n, r) => {
    surface(p, r, '#5c3a3a', 0.18, 0.14, 3);
  },
};

/** Flat panel with a soft raised edge, the way Kenney kits model their tiles. */
function flatPanel(p: Pix, x: number, y: number, w: number, h: number, edge = 3): void {
  p.shade(x, y, w, edge, 1.08);
  p.shade(x, y + edge, edge, h - edge, 1.04);
  p.shade(x, y + h - edge, w, edge, 0.9);
  p.shade(x + w - edge, y, edge, h - edge, 0.94);
}

/** Surprise box face: purple with a gold rim and a big white question mark. */
function paintSurprise(p: Pix, n: number): void {
  p.fill(0, 0, n, n, '#8a5cf0');
  p.fill(0, 0, n, 12, '#f5c542');
  p.fill(0, n - 12, n, 12, '#f5c542');
  p.fill(0, 0, 12, n, '#f5c542');
  p.fill(n - 12, 0, 12, n, '#f5c542');
  flatPanel(p, 0, 0, n, n, 4);
  flatPanel(p, 12, 12, n - 24, n - 24, 3);
  const glyph = ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'];
  const u = 10;
  const x0 = (n - 5 * u) / 2;
  const y0 = (n - 7 * u) / 2;
  glyph.forEach((row, gy) => {
    for (let gx = 0; gx < 5; gx++) if (row[gx] === '#') p.fill(x0 + gx * u, y0 + gy * u, u, u, '#ffffff');
  });
}

/** Clean, flat-coloured surfaces (no grime, grain or rivets) to sit next to Kenney models. */
const FLAT_PAINTERS: Record<string, Paint> = {
  ...THEMED,
  concrete: (p, n) => {
    p.fill(0, 0, n, n, '#c4bfb3');
    flatPanel(p, 0, 0, n, n / 2);
    flatPanel(p, 0, n / 2, n, n / 2);
  },
  tile: (p, n) => {
    p.fill(0, 0, n, n, '#dfe4e1');
    for (const x of [0, n / 2]) for (const y of [0, n / 2]) flatPanel(p, x, y, n / 2, n / 2, 2);
  },
  metal: (p, n) => {
    p.fill(0, 0, n, n, '#9fb0bb');
    flatPanel(p, 0, 0, n, n, 4);
  },
  panel: (p, n) => {
    p.fill(0, 0, n, n, '#aebdca');
    flatPanel(p, 0, 0, n, n / 2, 4);
    flatPanel(p, 0, n / 2, n, n / 2, 4);
  },
  ceiling: (p, n) => {
    p.fill(0, 0, n, n, '#d3d6d8');
    for (const x of [0, n / 2]) for (const y of [0, n / 2]) flatPanel(p, x, y, n / 2, n / 2, 2);
  },
  wood: (p, n) => {
    p.fill(0, 0, n, n, '#c99460');
    for (let i = 0; i < 4; i++) flatPanel(p, 0, (i * n) / 4, n, n / 4, 2);
  },
  snow: (p, n) => {
    p.fill(0, 0, n, n, '#f1f5f7');
  },
  ice: (p, n) => {
    p.fill(0, 0, n, n, '#c6e6f2');
    for (let i = 0; i < 3; i++) p.shade(((i * 41) % n) | 0, 0, 6, n, 1.06);
  },
  rock: (p, n) => {
    p.fill(0, 0, n, n, '#968f86');
    flatPanel(p, 0, 0, n / 2, n / 2, 4);
    flatPanel(p, n / 2, 0, n / 2, n / 2, 4);
    flatPanel(p, n / 4, n / 2, n / 2, n / 2, 4);
    flatPanel(p, -n / 4, n / 2, n / 2, n / 2, 4);
  },
  brick: (p, n) => {
    p.fill(0, 0, n, n, '#e6dccb');
    const bh = n / 4;
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? n / 4 : 0;
      for (let i = -1; i < 2; i++) {
        const x = off + i * (n / 2) + 2;
        p.fill(x, row * bh + 2, n / 2 - 4, bh - 4, '#cf7357');
        flatPanel(p, x, row * bh + 2, n / 2 - 4, bh - 4, 2);
      }
    }
  },
  grate: (p, n) => {
    p.fill(0, 0, n, n, '#6c7680');
    for (let i = 0; i < n; i += 16) {
      p.shade(i, 0, 3, n, 0.75);
      p.shade(0, i, n, 3, 0.75);
    }
  },
  crate: (p, n) => {
    p.fill(0, 0, n, n, '#d9a160');
    flatPanel(p, 0, 0, n, n, 10);
    p.shade(10, 10, n - 20, n - 20, 0.94);
  },
  barrel: (p, n) => {
    p.fill(0, 0, n, n, '#d6543f');
    for (const y of [n / 5, (4 * n) / 5]) p.shade(0, y - 4, n, 8, 0.8);
  },
  console: (p, n) => {
    p.fill(0, 0, n, n, '#4a5d72');
    flatPanel(p, 0, 0, n, n, 4);
    p.fill(n / 6, n / 6, (2 * n) / 3, n / 3, '#5fd0f0');
    flatPanel(p, n / 6, n / 6, (2 * n) / 3, n / 3, 3);
    const lights = ['#f5c542', '#7ad36b', '#ef6b5b', '#f5c542'];
    lights.forEach((c, i) => p.fill(n / 6 + i * (n / 6), (2 * n) / 3, 10, 10, c));
  },
  door: (p, n) => {
    p.fill(0, 0, n, n, '#b8956a');
    flatPanel(p, 6, 6, n - 12, n - 12, 4);
  },
  door_red: (p, n) => {
    p.fill(0, 0, n, n, '#d9574a');
    flatPanel(p, 6, 6, n - 12, n - 12, 4);
    p.fill(n / 2 - 14, n / 3, 28, 18, '#f4ede0');
  },
  door_blue: (p, n) => {
    p.fill(0, 0, n, n, '#4f78d6');
    flatPanel(p, 6, 6, n - 12, n - 12, 4);
    p.fill(n / 2 - 14, n / 3, 28, 18, '#f4ede0');
  },
  hazard: (p, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const yellow = ((x + y) >> 4) % 2 === 0;
      p.set(x, y, yellow ? 246 : 58, yellow ? 197 : 62, yellow ? 66 : 70);
    }
  },
  roof: (p, n) => {
    p.fill(0, 0, n, n, '#5d7a96');
    const rh = n / 4;
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? n / 8 : 0;
      for (let i = -1; i < 4; i++) flatPanel(p, off + (i * n) / 4, row * rh, n / 4, rh, 2);
    }
  },
  carpet: (p, n) => {
    p.fill(0, 0, n, n, '#b35556');
  },
  alarm: (p, n) => {
    p.fill(0, 0, n, n, '#f2c443');
    flatPanel(p, 0, 0, n, n, 6);
    p.fill(n / 2 - 26, n / 2 - 26, 52, 52, '#3d4450');
    p.fill(n / 2 - 18, n / 2 - 18, 36, 36, '#ef3b2f');
    flatPanel(p, n / 2 - 18, n / 2 - 18, 36, 36, 4);
  },
};

let painters = PAINTERS;

/** Switches every level surface to the flat style. Call before the first texture is built. */
export function useFlatTextures(on: boolean): void {
  painters = on ? { ...PAINTERS, ...FLAT_PAINTERS } : PAINTERS;
  cache.clear();
}

const cache = new Map<string, THREE.Texture>();
/** Every texture the game uses (procedural and from models), so the filter mode can switch at runtime. */
const managed = new Set<THREE.Texture>();
let smooth = true;

function applyFilter(t: THREE.Texture): void {
  if (smooth) {
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 8;
  } else {
    // Nearest up close for the pixel look; nearest mipmaps far away so walls do not shimmer.
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapNearestFilter;
    t.anisotropy = 1;
  }
  t.needsUpdate = true;
}

export function manageTexture(t: THREE.Texture): void {
  if (managed.has(t)) return;
  managed.add(t);
  applyFilter(t);
}

/** Smooth (filtered) or retro (nearest) sampling for all managed textures. */
export function setTextureSmoothing(on: boolean): void {
  if (on === smooth) return;
  smooth = on;
  for (const t of managed) applyFilter(t);
}

export function hasTexture(name: string): boolean {
  return name in painters;
}

export function getTexture(name: string): THREE.Texture | null {
  const paint = painters[name];
  if (!paint) return null;
  let t = cache.get(name);
  if (t) return t;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  let seed = 7;
  for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const pix = new Pix(size, ctx.createImageData(size, size));
  paint(pix, size, seeded(seed));
  pix.flush(ctx);
  t = new THREE.CanvasTexture(canvas);
  t.generateMipmaps = true;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  manageTexture(t);
  cache.set(name, t);
  return t;
}

/** Textured, vertex-lit material; falls back to a flat colour for unknown names. */
export function texturedMaterial(name: string, fallback: string): THREE.MeshBasicMaterial {
  const map = getTexture(name);
  return map ? new THREE.MeshBasicMaterial({ map, vertexColors: true }) : new THREE.MeshBasicMaterial({ color: fallback, vertexColors: true });
}
