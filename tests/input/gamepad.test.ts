import { describe, expect, it } from 'vitest';
import { isNintendoPad, labelOrder, PAD } from '../../src/input/gamepad';

describe('gamepad: Nintendo button labels', () => {
  it('recognises Nintendo pads by browser id', () => {
    expect(isNintendoPad('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')).toBe(true);
    expect(isNintendoPad('Nintendo Switch Pro Controller')).toBe(true);
    expect(isNintendoPad('Joy-Con (L/R)')).toBe(true);
    expect(isNintendoPad('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)')).toBe(false);
    expect(isNintendoPad('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe(false);
  });

  it('swaps A/B and X/Y on Nintendo pads only', () => {
    const bottomPressed = [true, false, false, false, false];
    expect(labelOrder(bottomPressed, false)[PAD.A]).toBe(true);
    // The bottom button of a Nintendo pad is labelled B.
    expect(labelOrder(bottomPressed, true)[PAD.B]).toBe(true);
    expect(labelOrder(bottomPressed, true)[PAD.A]).toBe(false);
    const topPressed = [false, false, false, true];
    expect(labelOrder(topPressed, true)[PAD.X]).toBe(true);
    expect(labelOrder(bottomPressed, true)[4]).toBe(false);
  });
});
