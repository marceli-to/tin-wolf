/**
 * Synthesised background music: a small step sequencer on Web Audio. No sample files; every mood is
 * a few bars of bass, arpeggio, lead and drums, looped. Mood changes take effect at the next bar.
 */
export type Mood = 'none' | 'menu' | 'sneak' | 'alert' | 'versus';

type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine';

interface Voice {
  /** Space-separated steps, 16 per bar: a note name (A2, C#4), '.' for rest, 'x' for a drum hit. */
  steps: string;
  wave?: Wave;
  /** Note length in steps. */
  len?: number;
  vol: number;
  /** Lowpass cutoff (Hz) for pitched voices. */
  cutoff?: number;
}

interface Track {
  bpm: number;
  bass?: Voice;
  arp?: Voice;
  lead?: Voice;
  kick?: Voice;
  snare?: Voice;
  hat?: Voice;
}

const TRACKS: Record<Exclude<Mood, 'none'>, Track> = {
  menu: {
    bpm: 92,
    bass: { steps: 'A2 . . . . . . . . . . . E2 . . . | F2 . . . . . . . . . . . G2 . . . | A2 . . . . . . . . . . . E2 . . . | D2 . . . . . . . E2 . . . . . . .', wave: 'triangle', len: 10, vol: 0.32, cutoff: 900 },
    arp: { steps: 'A3 . C4 . E4 . C4 . A3 . C4 . E4 . C4 . | F3 . A3 . C4 . A3 . F3 . A3 . C4 . A3 . | A3 . C4 . E4 . C4 . A3 . C4 . E4 . C4 . | D4 . F4 . A4 . F4 . E4 . G#4 . B4 . G#4 .', wave: 'triangle', len: 2, vol: 0.09 },
    lead: { steps: '. . . . . . . . . . . . . . . . | E5 . . . D5 . . C5 . . . . B4 . . . | . . . . . . . . . . . . . . . . | A4 . . . C5 . . B4 . . . . . . . .', wave: 'square', len: 3, vol: 0.05, cutoff: 2400 },
    hat: { steps: '. . x . . . x . . . x . . . x . | . . x . . . x . . . x . . . x . | . . x . . . x . . . x . . . x . | . . x . . . x . . . x . . . x .', vol: 0.04 },
  },
  sneak: {
    bpm: 88,
    bass: { steps: 'A1 . . . . . . . A1 . . . G1 . . . | F1 . . . . . . . F1 . . . E1 . . . | A1 . . . . . . . A1 . . . C2 . . . | D2 . . . . . . . E1 . . . . . . .', wave: 'triangle', len: 6, vol: 0.4, cutoff: 700 },
    arp: { steps: 'A3 . . . E4 . . . A3 . . . E4 . . . | F3 . . . C4 . . . F3 . . . C4 . . . | A3 . . . E4 . . . A3 . . . E4 . . . | D4 . . . A3 . . . E4 . . . B3 . . .', wave: 'triangle', len: 3, vol: 0.07 },
    lead: { steps: '. . . . . . . . . . . . . . . . | . . . . . . . . E5 . . D5 . . C5 . | . . . . . . . . . . . . . . . . | B4 . . . . . . . . . . . . . . .', wave: 'triangle', len: 4, vol: 0.06 },
    kick: { steps: 'x . . . . . . . x . . . . . . . | x . . . . . . . x . . . . . . . | x . . . . . . . x . . . . . . . | x . . . . . . . x . . . . . . .', vol: 0.25 },
    hat: { steps: '. . . . x . . . . . . . x . . . | . . . . x . . . . . . . x . . . | . . . . x . . . . . . . x . . . | . . . . x . . . . . . . x . x .', vol: 0.03 },
  },
  alert: {
    bpm: 132,
    bass: { steps: 'A2 . A2 . A3 . A2 . G2 . G2 . G3 . G2 . | F2 . F2 . F3 . F2 . E2 . E2 . E3 . E2 . | A2 . A2 . A3 . A2 . G2 . G2 . G3 . G2 . | F2 . F2 . F3 . F2 . E2 . E3 . G#2 . B2 .', wave: 'square', len: 1, vol: 0.2, cutoff: 1100 },
    lead: { steps: 'A4 . . A4 . . C5 . . . B4 . A4 . . . | E5 . . . D5 . . C5 . . B4 . . . . . | A4 . . A4 . . C5 . . . D5 . E5 . . . | F5 . . . E5 . . D5 . . C5 . B4 . . .', wave: 'square', len: 2, vol: 0.06, cutoff: 3000 },
    kick: { steps: 'x . . . x . . . x . . . x . . . | x . . . x . . . x . . . x . . . | x . . . x . . . x . . . x . . . | x . . . x . . . x . . x x . x .', vol: 0.32 },
    snare: { steps: '. . . . x . . . . . . . x . . . | . . . . x . . . . . . . x . . . | . . . . x . . . . . . . x . . . | . . . . x . . . . . . . x . x x', vol: 0.12 },
    hat: { steps: 'x . x . x . x . x . x . x . x . | x . x . x . x . x . x . x . x . | x . x . x . x . x . x . x . x . | x . x . x . x . x . x . x . x .', vol: 0.035 },
  },
  versus: {
    bpm: 126,
    bass: { steps: 'C2 . C3 . C2 . C3 . A1 . A2 . A1 . A2 . | F1 . F2 . F1 . F2 . G1 . G2 . G1 . G2 . | C2 . C3 . C2 . C3 . A1 . A2 . A1 . A2 . | F1 . F2 . G1 . G2 . C2 . C3 . C2 . . .', wave: 'square', len: 1, vol: 0.18, cutoff: 1200 },
    arp: { steps: 'C4 E4 G4 E4 C4 E4 G4 E4 A3 C4 E4 C4 A3 C4 E4 C4 | F3 A3 C4 A3 F3 A3 C4 A3 G3 B3 D4 B3 G3 B3 D4 B3 | C4 E4 G4 E4 C4 E4 G4 E4 A3 C4 E4 C4 A3 C4 E4 C4 | F3 A3 C4 A3 G3 B3 D4 B3 C4 E4 G4 C5 . . . .', wave: 'triangle', len: 1, vol: 0.06 },
    lead: { steps: 'E5 . G5 . A5 . G5 . E5 . D5 . C5 . . . | D5 . E5 . G5 . E5 . D5 . C5 . D5 . . . | E5 . G5 . A5 . C6 . B5 . A5 . G5 . . . | A5 . G5 . E5 . D5 . C5 . . . . . . .', wave: 'square', len: 2, vol: 0.05, cutoff: 3200 },
    kick: { steps: 'x . . . x . . . x . . . x . . . | x . . . x . . . x . . . x . . . | x . . . x . . . x . . . x . . . | x . . . x . . . x . x . x . x .', vol: 0.3 },
    snare: { steps: '. . . . x . . . . . . . x . . . | . . . . x . . . . . . . x . . . | . . . . x . . . . . . . x . . . | . . . . x . . . . . . . x x x x', vol: 0.1 },
    hat: { steps: '. . x . . . x . . . x . . . x . | . . x . . . x . . . x . . . x . | . . x . . . x . . . x . . . x . | . . x . . . x . . . x . . . x .', vol: 0.04 },
  },
};

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

/** Frequency of a note name such as 'A4' or 'C#3'; null for a rest. */
export function noteFreq(name: string): number | null {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) return null;
  const midi = (Number(m[2]) + 1) * 12 + NOTE[m[1]!]!;
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Steps of a voice, bar separators removed. */
export function parseSteps(steps: string): string[] {
  return steps.split(/\s+/).filter((s) => s && s !== '|');
}

const LOOKAHEAD = 0.15;

export class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private mood: Mood = 'none';
  /** The track being played; switches to `mood` at the next bar. */
  private playing: Mood = 'none';
  private step = 0;
  private nextTime = 0;
  private parsed = new Map<string, string[]>();
  volume = 0.5;

  /** Attach to the game's audio context once it exists (after the first user gesture). */
  attach(ctx: AudioContext, noise: AudioBuffer): void {
    if (this.ctx) return;
    this.ctx = ctx;
    this.noise = noise;
    this.out = ctx.createGain();
    this.out.gain.value = this.volume;
    this.out.connect(ctx.destination);
    setInterval(() => this.schedule(), 25);
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  setMood(m: Mood): void {
    this.mood = m;
  }

  private steps(v: Voice): string[] {
    let s = this.parsed.get(v.steps);
    if (!s) {
      s = parseSteps(v.steps);
      this.parsed.set(v.steps, s);
    }
    return s;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.out || ctx.state !== 'running') return;
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      // Mood changes wait for a bar line so phrases are not cut off mid-bar.
      if (this.step % 16 === 0 && this.playing !== this.mood) {
        this.playing = this.mood;
        this.step = 0;
      }
      const track = this.playing === 'none' ? null : TRACKS[this.playing];
      if (!track) {
        this.nextTime += 0.1;
        continue;
      }
      const dur = 60 / track.bpm / 4;
      this.playStep(track, this.step, this.nextTime, dur);
      this.step++;
      this.nextTime += dur;
    }
  }

  private playStep(t: Track, step: number, at: number, dur: number): void {
    for (const v of [t.bass, t.arp, t.lead]) {
      if (!v) continue;
      const s = this.steps(v);
      const f = noteFreq(s[step % s.length] ?? '.');
      if (f) this.tone(v, f, at, dur * (v.len ?? 1));
    }
    if (t.kick && this.hit(t.kick, step)) this.kick(at, t.kick.vol);
    if (t.snare && this.hit(t.snare, step)) this.noiseHit(at, 0.14, 'bandpass', 1800, t.snare.vol);
    if (t.hat && this.hit(t.hat, step)) this.noiseHit(at, 0.04, 'highpass', 7000, t.hat.vol);
  }

  private hit(v: Voice, step: number): boolean {
    const s = this.steps(v);
    return s[step % s.length] === 'x';
  }

  private tone(v: Voice, f: number, at: number, len: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = v.wave ?? 'square';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(v.vol, at + 0.01);
    g.gain.setValueAtTime(v.vol, at + Math.max(0.02, len * 0.7));
    g.gain.exponentialRampToValueAtTime(0.0005, at + len);
    let node: AudioNode = o;
    if (v.cutoff) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = v.cutoff;
      o.connect(lp);
      node = lp;
    }
    node.connect(g).connect(this.out!);
    o.start(at);
    o.stop(at + len + 0.05);
  }

  private kick(at: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
    o.connect(g).connect(this.out!);
    o.start(at);
    o.stop(at + 0.2);
  }

  private noiseHit(at: number, dur: number, type: BiquadFilterType, freq: number, vol: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(f).connect(g).connect(this.out!);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }
}

/** Every voice of every track has a whole number of bars (16 steps each). */
export function trackLengths(): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [name, t] of Object.entries(TRACKS)) {
    out[name] = [t.bass, t.arp, t.lead, t.kick, t.snare, t.hat].filter((v): v is Voice => !!v).map((v) => parseSteps(v.steps).length);
  }
  return out;
}
