import { describe, expect, it } from 'vitest';
import { canPay, payFor, type SpellPool } from '../../src/rules/spell-points.ts';

describe('paying for a spell (1.5.11, docs/rules-adaptation.md, Spell points)', () => {
  it('spends a slot while any are left, whatever the spell’s level', () => {
    const pool: SpellPool = { spellsLeft: 1, pointsLeft: 0 };
    expect(canPay(pool, 3)).toBe(true);
    const after = payFor(pool, 3);
    expect(after).toEqual({ spellsLeft: 0, pointsLeft: 0 });
    expect(canPay(after, 1)).toBe(false);
    // The pool paid from is left as it was: src/game assigns the result (AGENTS.md, Layers).
    expect(pool).toEqual({ spellsLeft: 1, pointsLeft: 0 });
  });

  it('then spends points equal to the spell’s level, and the same spell can repeat', () => {
    let pool: SpellPool = { spellsLeft: 0, pointsLeft: 5 };
    pool = payFor(payFor(pool, 2), 2);
    expect(pool.pointsLeft).toBe(1);
    expect(canPay(pool, 2)).toBe(false);
    expect(canPay(pool, 1)).toBe(true);
    expect(payFor(pool, 1)).toEqual({ spellsLeft: 0, pointsLeft: 0 });
  });

  it('refuses a spell it can’t pay for', () => {
    expect(() => payFor({ spellsLeft: 0, pointsLeft: 2 }, 3)).toThrow(
      'nothing left to pay for a level-3 spell',
    );
  });
});
