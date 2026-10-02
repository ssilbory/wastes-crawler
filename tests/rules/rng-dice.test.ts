import { describe, expect, it } from 'vitest';
import { maxRoll, roll, rollDice, rollDie } from '../../src/rules/dice.ts';
import { createRng, rngFromState } from '../../src/rules/rng.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

describe('createRng', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng('xp-sim');
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(seqA);
  });

  it('gives the same stream for the same string seed', () => {
    expect(createRng('loot').int(1, 1000)).toBe(createRng('loot').int(1, 1000));
  });

  it('restores an identical stream from its state', () => {
    const rng = createRng(7);
    rng.next();
    const copy = rngFromState(rng.state());
    expect(Array.from({ length: 10 }, () => copy.int(1, 20))).toEqual(
      Array.from({ length: 10 }, () => rng.int(1, 20)),
    );
  });

  it('keeps independent streams independent', () => {
    const game = createRng(1);
    const sim = createRng(1);
    const expected = createRng(1).int(1, 100);
    for (let i = 0; i < 50; i++) sim.int(1, 100);
    expect(game.int(1, 100)).toBe(expected);
  });

  it('returns floats in [0, 1) and integers in range with a roughly flat distribution', () => {
    const rng = createRng(2026);
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 60_000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const face = rng.int(1, 6);
      counts[face - 1] = (counts[face - 1] ?? 0) + 1;
    }
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(500);
  });

  it('handles a single-value range and rejects bad ranges and states', () => {
    const rng = createRng(3);
    expect(rng.int(5, 5)).toBe(5);
    expect(() => rng.int(6, 5)).toThrow();
    expect(() => rng.int(1.5, 3)).toThrow();
    expect(() => rngFromState([0, 0, 0, 0])).toThrow();
  });

  it('matches the xoshiro128** reference output', () => {
    const rng = rngFromState([1, 2, 3, 4]);
    expect([rng.next(), rng.next(), rng.next()].map((f) => f * 2 ** 32)).toEqual([
      11520, 0, 5927040,
    ]);
  });

  it('rejects draws in the biased tail', () => {
    // With a range of 2^31 + 1, about half of all uint32 draws fall in the rejected tail.
    const rng = createRng(9);
    for (let i = 0; i < 200; i++) {
      const v = rng.int(0, 2 ** 31);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(2 ** 31);
    }
  });
});

describe('dice', () => {
  it('rolls expressions with modifiers and reports each die', () => {
    expect(roll(scriptedRng([3, 5]), { count: 2, sides: 6, modifier: 4 })).toEqual({
      total: 12,
      dice: [3, 5],
    });
    expect(rollDie(scriptedRng([20]), 20)).toBe(20);
    expect(rollDice(scriptedRng([1, 2, 3]), 3, 4)).toEqual([1, 2, 3]);
    expect(maxRoll({ count: 10, sides: 6, modifier: -10 })).toBe(50);
  });
});
