import type { SplitMode } from '../render/views';

export interface Settings {
  /** Multiplier on the base mouse sensitivity. */
  mouseSens: number;
  padSens: number;
  invertY: boolean;
  split: SplitMode;
  volume: number;
  /** Retro internal render height; 0 = smooth native rendering. */
  resolution: number;
  /** Gamepad aim assist. */
  aimAssist: boolean;
  /** Mission difficulty, a key of data/difficulty.json. */
  difficulty: string;
  /** Music volume 0..1 (separate from sound effects). */
  music: number;
}

export const DEFAULT_SETTINGS: Settings = { mouseSens: 1, padSens: 1, invertY: false, split: 'vertical', volume: 0.7, resolution: 0, aimAssist: true, difficulty: 'normal', music: 0.5 };

export const DIFFICULTIES = ['easy', 'normal', 'hard'];

/** 0 = smooth native rendering; the others are retro pixel heights. */
export const RESOLUTIONS = [0, 480, 360, 240, 180];
// Old name kept so saved settings survive the rename to Tin Fox.
const KEY = 'tin-wolf.settings.v2';

/** localStorage can be missing or throw (private mode, blocked storage); settings then just do not persist. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const v = JSON.parse(raw) as Partial<Settings>;
    return {
      mouseSens: clampNum(v.mouseSens, 0.2, 4, DEFAULT_SETTINGS.mouseSens),
      padSens: clampNum(v.padSens, 0.2, 4, DEFAULT_SETTINGS.padSens),
      invertY: typeof v.invertY === 'boolean' ? v.invertY : DEFAULT_SETTINGS.invertY,
      split: v.split === 'horizontal' ? 'horizontal' : 'vertical',
      volume: clampNum(v.volume, 0, 1, DEFAULT_SETTINGS.volume),
      resolution: RESOLUTIONS.includes(v.resolution as number) ? (v.resolution as number) : DEFAULT_SETTINGS.resolution,
      aimAssist: typeof v.aimAssist === 'boolean' ? v.aimAssist : DEFAULT_SETTINGS.aimAssist,
      difficulty: DIFFICULTIES.includes(v.difficulty as string) ? (v.difficulty as string) : DEFAULT_SETTINGS.difficulty,
      music: clampNum(v.music, 0, 1, DEFAULT_SETTINGS.music),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Not persisted; the game still uses the values for this session.
  }
}

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}
