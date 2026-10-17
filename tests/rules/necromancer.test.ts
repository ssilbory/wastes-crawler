import { describe, expect, it } from 'vitest';
import { coldFleshAc } from '../../src/rules/necromancer.ts';

describe('coldFleshAc (1.5.14)', () => {
  it('is 12 plus half the level, rounded down', () => {
    expect(coldFleshAc(1)).toBe(12);
    expect(coldFleshAc(2)).toBe(13);
    expect(coldFleshAc(3)).toBe(13);
    expect(coldFleshAc(10)).toBe(17);
  });
});
