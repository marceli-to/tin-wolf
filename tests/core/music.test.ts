import { describe, expect, it } from 'vitest';
import { noteFreq, parseSteps, trackLengths } from '../../src/audio/music';

describe('music', () => {
  it('turns note names into frequencies', () => {
    expect(noteFreq('A4')).toBeCloseTo(440);
    expect(noteFreq('A3')).toBeCloseTo(220);
    expect(noteFreq('C4')).toBeCloseTo(261.63, 1);
    expect(noteFreq('C#4')).toBeCloseTo(277.18, 1);
    expect(noteFreq('.')).toBeNull();
    expect(noteFreq('x')).toBeNull();
  });

  it('drops bar separators', () => {
    expect(parseSteps('A2 . | . x')).toEqual(['A2', '.', '.', 'x']);
  });

  it('every voice is exactly four bars of sixteen steps', () => {
    for (const [name, lens] of Object.entries(trackLengths())) for (const n of lens) expect(n, name).toBe(64);
  });
});
