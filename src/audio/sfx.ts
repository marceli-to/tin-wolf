/** Synthesised sound effects. No sample files: everything is built from oscillators and noise. */
export type SfxName =
  | 'pistol_shot'
  | 'reload_out'
  | 'reload_in'
  | 'dry'
  | 'hit_flesh'
  | 'hit_marker'
  | 'hurt'
  | 'death'
  | 'footstep'
  | 'impact'
  | 'door'
  | 'pickup'
  | 'alert'
  | 'objective'
  | 'explosion'
  | 'locked'
  | 'ui_move'
  | 'ui_select';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  volume = 0.7;

  /** Must be called from a user gesture before anything is audible. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  /** `vol` 0..1, `pan` -1..1, `delay` seconds from now. */
  play(name: SfxName, vol = 1, pan = 0, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || vol < 0.01 || ctx.state !== 'running') return;
    const out = ctx.createGain();
    out.gain.value = vol;
    let node: AudioNode = out;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(p);
      node = p;
    }
    node.connect(this.master);
    const t = ctx.currentTime + delay;
    switch (name) {
      case 'pistol_shot':
        this.noiseBurst(out, t, 0.16, 'lowpass', 3200, 0.9, 1.0);
        this.noiseBurst(out, t, 0.04, 'highpass', 4000, 0.5, 1.0);
        this.tone(out, t, 'sine', 140, 45, 0.12, 0.9);
        break;
      case 'reload_out':
        this.click(out, t, 1800, 0.5);
        this.click(out, t + 0.08, 1200, 0.35);
        break;
      case 'reload_in':
        this.click(out, t, 900, 0.6);
        this.click(out, t + 0.12, 2200, 0.5);
        break;
      case 'dry':
        this.click(out, t, 3000, 0.4);
        break;
      case 'hit_flesh':
        this.noiseBurst(out, t, 0.08, 'lowpass', 900, 0.8, 1);
        this.tone(out, t, 'sine', 200, 80, 0.08, 0.4);
        break;
      case 'hit_marker':
        this.tone(out, t, 'square', 1800, 1800, 0.035, 0.15);
        break;
      case 'hurt':
        this.tone(out, t, 'sawtooth', 220, 90, 0.18, 0.35);
        this.noiseBurst(out, t, 0.1, 'lowpass', 600, 0.6, 1);
        break;
      case 'death':
        this.tone(out, t, 'sawtooth', 300, 40, 0.7, 0.4);
        this.noiseBurst(out, t, 0.25, 'lowpass', 500, 0.6, 1);
        break;
      case 'footstep':
        this.noiseBurst(out, t, 0.05, 'bandpass', 400 + Math.random() * 200, 0.5, 2);
        break;
      case 'impact':
        this.noiseBurst(out, t, 0.06, 'bandpass', 2500, 0.35, 1.5);
        break;
      case 'door':
        this.tone(out, t, 'sawtooth', 70, 90, 0.6, 0.18);
        this.noiseBurst(out, t, 0.6, 'lowpass', 300, 0.4, 1);
        this.click(out, t + 0.55, 500, 0.5);
        break;
      case 'pickup':
        this.tone(out, t, 'square', 660, 660, 0.06, 0.18);
        this.tone(out, t + 0.07, 'square', 990, 990, 0.08, 0.18);
        break;
      case 'alert':
        this.tone(out, t, 'square', 520, 520, 0.12, 0.25);
        this.tone(out, t + 0.14, 'square', 780, 780, 0.16, 0.25);
        break;
      case 'objective':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(out, t + i * 0.09, 'triangle', f, f, 0.14, 0.3));
        break;
      case 'explosion':
        this.noiseBurst(out, t, 0.9, 'lowpass', 700, 1.0, 1);
        this.tone(out, t, 'sine', 90, 30, 0.6, 0.9);
        break;
      case 'locked':
        this.tone(out, t, 'square', 180, 180, 0.12, 0.25);
        this.tone(out, t + 0.14, 'square', 140, 140, 0.16, 0.25);
        break;
      case 'ui_move':
        this.tone(out, t, 'square', 440, 440, 0.04, 0.12);
        break;
      case 'ui_select':
        this.tone(out, t, 'square', 660, 880, 0.08, 0.15);
        break;
    }
  }

  private tone(out: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(out: AudioNode, t: number, dur: number, type: BiquadFilterType, freq: number, vol: number, q: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private click(out: AudioNode, t: number, freq: number, vol: number): void {
    this.noiseBurst(out, t, 0.025, 'bandpass', freq, vol, 4);
  }
}
