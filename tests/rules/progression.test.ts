import { describe, expect, it } from 'vitest';
import { loadSrd } from '../../src/data/load.ts';
import type { Progression } from '../../src/data/schemas/index.ts';
import {
  castingRow,
  characterLevel,
  cycleSourceLevel,
  hitDiceForLevels,
  levelHitDie,
  levelUp,
  progressionRow,
  startingClass,
  switchClass,
  totalAttackBonus,
  type ClassLevels,
} from '../../src/rules/progression.ts';

const srd = loadSrd();
const lookup = (id: string): Progression => {
  const p = srd.progressions.find((x) => x.id === id);
  if (!p) throw new Error(`no progression ${id}`);
  return p;
};
const casting = (id: string) => {
  const c = srd['casting-progressions'].find((x) => x.id === id);
  if (!c) throw new Error(`no casting progression ${id}`);
  return c;
};
const known = (id: string) => srd.progressions.some((p) => p.id === id);
const sw = (c: ClassLevels, target: string, inTown: boolean) =>
  switchClass(c, target, inTown, known);
const warrior = lookup('full-warrior');
const expert = lookup('full-expert');
const any1 = [{ count: 1, category: 'any' }];

describe('progressionRow', () => {
  it('reads the SRD table through 10th level', () => {
    expect(progressionRow(warrior, 1)).toEqual({
      level: 1,
      hitDice: { count: 1, sides: 6, modifier: 2 },
      attackBonus: 1,
      focusPicks: [
        { count: 1, category: 'warrior' },
        { count: 1, category: 'any' },
      ],
    });
    expect(progressionRow(warrior, 10)).toMatchObject({
      hitDice: { count: 10, modifier: 20 },
      attackBonus: 10,
      focusPicks: any1,
    });
  });

  it('cycles the gains of levels 3–10 past 10th', () => {
    expect(progressionRow(warrior, 11)).toMatchObject({
      hitDice: { count: 11, modifier: 22 },
      attackBonus: 11,
      focusPicks: [],
    });
    expect(progressionRow(warrior, 18)).toMatchObject({ attackBonus: 18, focusPicks: any1 });
    expect(progressionRow(warrior, 26)).toMatchObject({ hitDice: { count: 26 }, attackBonus: 26 });
    expect(progressionRow(expert, 11).attackBonus).toBe(5);
    expect(progressionRow(expert, 12).attackBonus).toBe(6);
    expect([13, 15, 18].map((l) => progressionRow(expert, l).focusPicks)).toEqual([
      any1,
      any1,
      any1,
    ]);
    expect(progressionRow(expert, 14).focusPicks).toEqual([]);
  });

  it('maps levels past 10th onto the 3–10 cycle', () => {
    expect([1, 10, 11, 18, 19, 26, 27].map(cycleSourceLevel)).toEqual([1, 10, 3, 10, 3, 10, 3]);
  });

  it('rejects invalid levels', () => {
    expect(() => progressionRow(warrior, 0)).toThrow();
    expect(() => progressionRow(warrior, 2.5)).toThrow();
    expect(() => progressionRow({ ...warrior, levels: warrior.levels.slice(0, 5) }, 7)).toThrow();
  });
});

describe('levelHitDie', () => {
  it('keeps the per-level die in the second cycle', () => {
    expect(levelHitDie(warrior, 19)).toEqual({ count: 1, sides: 6, modifier: 2 });
    expect(levelHitDie(warrior, 27)).toEqual({ count: 1, sides: 6, modifier: 2 });
  });

  it('gives each level its own die', () => {
    expect(levelHitDie(warrior, 1)).toEqual({ count: 1, sides: 6, modifier: 2 });
    expect(levelHitDie(warrior, 14)).toEqual({ count: 1, sides: 6, modifier: 2 });
    expect(levelHitDie(lookup('full-high-mage'), 3)).toEqual({ count: 1, sides: 6, modifier: -1 });
  });
});

describe('castingRow', () => {
  const elementalist = casting('full-elementalist-arts-and-spells');

  it('reads the SRD table and caps spell level at 5 past 10th', () => {
    expect(castingRow(elementalist, 1)).toEqual({
      level: 1,
      maxSpellLevel: 1,
      spellsCast: 1,
      spellPoints: 0,
      formBonus: 0,
      spellsPrepared: 3,
      arts: ['elemental-resilience', 'elemental-sparks'],
      anyArts: 1,
    });
    expect(castingRow(elementalist, 11)).toEqual({
      level: 11,
      maxSpellLevel: 5,
      spellsCast: 7,
      spellPoints: 0,
      formBonus: 0,
      spellsPrepared: 13,
      arts: [],
      anyArts: 0,
    });
    expect(castingRow(elementalist, 12).anyArts).toBe(1);
    expect(castingRow(elementalist, 19)).toMatchObject({
      maxSpellLevel: 5,
      spellsCast: 12,
      spellPoints: 0,
      spellsPrepared: 22,
    });
    expect(castingRow(elementalist, 20)).toMatchObject({ spellsCast: 12, spellsPrepared: 23 });
    expect(() => castingRow(elementalist, 0)).toThrow();
  });

  it('reads the Invoker’s spell points, extended past 10th like spells cast (1.5.11)', () => {
    const invoker = casting('full-invoker-spells');
    expect(castingRow(invoker, 1)).toMatchObject({
      spellsCast: 0,
      spellPoints: 1,
      spellsPrepared: 2,
    });
    expect(castingRow(invoker, 10)).toMatchObject({ spellPoints: 11, spellsPrepared: 9 });
    // 11 + (row 3 − row 2) = 11 + 1.
    expect(castingRow(invoker, 11).spellPoints).toBe(12);
  });
});

describe('class switching', () => {
  const expert4: ClassLevels = { current: 'full-expert', levels: { 'full-expert': 4 } };

  it('starts a character at 1st level in one class', () => {
    expect(startingClass('full-warrior')).toEqual({
      current: 'full-warrior',
      levels: { 'full-warrior': 1 },
    });
  });

  it('allows a switch only in town, at 4th level or higher, to another class', () => {
    expect(sw(expert4, 'full-warrior', false)).toEqual({
      ok: false,
      reason: 'not-in-town',
    });
    expect(sw(expert4, 'full-expert', true)).toEqual({ ok: false, reason: 'same-class' });
    const early = { current: 'full-expert', levels: { 'full-expert': 3 } };
    expect(sw(early, 'full-warrior', true)).toEqual({
      ok: false,
      reason: 'current-below-4',
    });
  });

  it('sums each class at its own level, with the new class starting from its level-1 row', () => {
    const switched = sw(expert4, 'full-warrior', true);
    if (!switched.ok) throw new Error('switch refused');
    const { classes, classLevel } = levelUp(switched.classes);
    expect(classLevel).toBe(1);
    expect(characterLevel(classes)).toBe(5);
    expect(totalAttackBonus(classes, lookup)).toBe(3);
    expect(hitDiceForLevels(classes, lookup).map((d) => d.modifier)).toEqual([0, 0, 0, 0, 2]);
  });

  it('picks up an earlier class where the character left off', () => {
    const back = sw(
      { current: 'full-warrior', levels: { 'full-expert': 4, 'full-warrior': 4 } },
      'full-expert',
      true,
    );
    if (!back.ok) throw new Error('switch refused');
    expect(levelUp(back.classes)).toMatchObject({
      classLevel: 5,
      classes: { levels: { 'full-expert': 5, 'full-warrior': 4 } },
    });
  });

  it('ignores a class with no levels yet', () => {
    const fresh = sw(expert4, 'full-warrior', true);
    if (!fresh.ok) throw new Error('switch refused');
    expect(totalAttackBonus(fresh.classes, lookup)).toBe(2);
    expect(levelUp({ current: 'x', levels: {} }).classLevel).toBe(1);
    expect(sw(expert4, 'not-a-class', true)).toEqual({ ok: false, reason: 'unknown-class' });
    expect(sw({ current: 'x', levels: { x: 2 } }, 'full-warrior', true)).toEqual({
      ok: false,
      reason: 'current-below-4',
    });
  });

  it('takes back a switch before any level in the new class', () => {
    const fresh = sw(expert4, 'full-warrior', true);
    if (!fresh.ok) throw new Error('switch refused');
    expect(sw(fresh.classes, 'full-expert', true)).toEqual({
      ok: true,
      classes: { current: 'full-expert', levels: { 'full-expert': 4 } },
    });
    // Only a switch away from a class with levels can be taken back.
    expect(sw({ current: 'constructor', levels: {} }, 'full-warrior', true)).toMatchObject({
      reason: 'current-below-4',
    });
    expect(sw({ current: 'x', levels: { x: 0 } }, 'full-warrior', true)).toMatchObject({
      reason: 'current-below-4',
    });
  });
});

describe('single-class invariants', () => {
  it('agrees with progressionRow for every class and level 1–30', () => {
    for (const p of srd.progressions) {
      for (let level = 1; level <= 30; level++) {
        const c: ClassLevels = { current: p.id, levels: { [p.id]: level } };
        const row = progressionRow(p, level);
        expect(totalAttackBonus(c, lookup)).toBe(row.attackBonus);
        const dice = hitDiceForLevels(c, lookup);
        expect(dice).toHaveLength(level);
        expect(dice.reduce((n, d) => n + d.count, 0)).toBe(row.hitDice.count);
        expect(dice.reduce((n, d) => n + d.modifier, 0)).toBe(row.hitDice.modifier);
      }
    }
  });
});
