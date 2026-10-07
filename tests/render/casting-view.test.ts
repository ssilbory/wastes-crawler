import { describe, expect, it } from 'vitest';
import { castingText, castsLeftText } from '../../src/render/casting-view.ts';
import type { CastingLevelRow } from '../../src/rules/progression.ts';

const row = (r: Partial<CastingLevelRow>): CastingLevelRow => ({
  level: 1,
  maxSpellLevel: 1,
  spellsCast: 0,
  spellPoints: 0,
  formBonus: 0,
  spellsPrepared: 2,
  arts: [],
  anyArts: 0,
  ...r,
});

describe('the casting line', () => {
  it('gives spells cast, spell points, or both', () => {
    expect(castingText(row({ spellsCast: 1, spellsPrepared: 3 }), false)).toBe(
      'Casts 1 a day, prepares 3, up to level 1.',
    );
    expect(castingText(row({ spellPoints: 1 }), true)).toBe(
      'Has 1 spell point a day, prepares 2, up to level 1.',
    );
    expect(castingText(row({ spellPoints: 0, spellsPrepared: 0 }), true)).toBe(
      'Has 0 spell points a day, prepares 0, up to level 1.',
    );
    expect(castingText(row({ spellsCast: 2, spellPoints: 5, maxSpellLevel: 2 }), true)).toBe(
      'Casts 2 a day and has 5 spell points a day, prepares 2, up to level 2.',
    );
  });

  it('gives preparations alone when there is nothing to pay with', () => {
    expect(castingText(row({}), false)).toBe('Prepares 2, up to level 1.');
  });

  it('is miracles only for a tradition with no spells', () => {
    const none = row({ maxSpellLevel: 0, spellsPrepared: 0 });
    expect(castingText(none, false, true)).toBe('Miracles only.');
    expect(castingText(none, false)).toBe('Arts only.');
  });
});

describe('what a caster has left today', () => {
  const magic = (spellsCast: number, points: boolean) =>
    ({ slots: row({ spellsCast }), points }) as Parameters<typeof castsLeftText>[1];
  it('counts spells, spell points, or both', () => {
    expect(castsLeftText({ spellsLeft: 1, pointsLeft: 0 }, magic(2, false))).toBe(
      '1 spell left today',
    );
    expect(castsLeftText({ spellsLeft: 0, pointsLeft: 3 }, magic(0, true))).toBe(
      '3 spell points left today',
    );
    expect(castsLeftText({ spellsLeft: 2, pointsLeft: 1 }, magic(2, true))).toBe(
      '2 spells and 1 spell point left today',
    );
  });
});
