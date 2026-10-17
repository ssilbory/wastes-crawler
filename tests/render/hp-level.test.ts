import { describe, expect, it } from 'vitest';
import { hpLevel } from '../../src/render/hp-level.ts';

describe('health bar steps', () => {
  it('is fine above half, hurt at half or less, and low at a quarter or less', () => {
    expect(hpLevel(100)).toBe('fine');
    expect(hpLevel(51)).toBe('fine');
    expect(hpLevel(50)).toBe('hurt');
    expect(hpLevel(26)).toBe('hurt');
    expect(hpLevel(25)).toBe('low');
    expect(hpLevel(0)).toBe('low');
  });

  it('counts below zero as low', () => {
    expect(hpLevel(-10)).toBe('low');
  });
});
