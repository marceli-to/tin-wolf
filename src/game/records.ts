/** Best course times per level, kept in localStorage (silently not persisted if storage is blocked). */
const KEY = 'tin-fox.records.v1';

type Records = Record<string, number>;

/** Read once; the HUD asks every frame. */
let cache: Records | null = null;

function load(): Records {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    cache = v && typeof v === 'object' ? (v as Records) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export function bestTime(levelId: string): number | null {
  const t = load()[levelId];
  return typeof t === 'number' && Number.isFinite(t) ? t : null;
}

/** Stores the time if it beats the record. Returns true for a new best. */
export function recordTime(levelId: string, time: number): boolean {
  const best = bestTime(levelId);
  if (best !== null && best <= time) return false;
  cache = { ...load(), [levelId]: time };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Not persisted.
  }
  return true;
}

/** 83.4 s → "1:23.4". */
export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}
