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
      spellsPrepared: 3,
      arts: ['elemental-resilience', 'elemental-sparks'],
      anyArts: 1,
    });
    expect(castingRow(elementalist, 11)).toEqual({
      level: 11,
      maxSpellLevel: 5,
      spellsCast: 7,
      spellsPrepared: 13,
      arts: [],
      anyArts: 0,
    });
    expect(castingRow(elementalist, 12).anyArts).toBe(1);
    expect(() => castingRow(elementalist, 0)).toThrow();
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
    expect(switchClass(expert4, 'full-warrior', false)).toEqual({
      ok: false,
      reason: 'not-in-town',
    });
    expect(switchClass(expert4, 'full-expert', true)).toEqual({ ok: false, reason: 'same-class' });
    const early = { current: 'full-expert', levels: { 'full-expert': 3 } };
    expect(switchClass(early, 'full-warrior', true)).toEqual({
      ok: false,
      reason: 'current-below-4',
    });
  });

  it('sums each class at its own level, with the new class starting from its level-1 row', () => {
    const switched = switchClass(expert4, 'full-warrior', true);
    if (!switched.ok) throw new Error('switch refused');
    const { classes, classLevel } = levelUp(switched.classes);
    expect(classLevel).toBe(1);
    expect(characterLevel(classes)).toBe(5);
    expect(totalAttackBonus(classes, lookup)).toBe(3);
    expect(hitDiceForLevels(classes, lookup).map((d) => d.modifier)).toEqual([0, 0, 0, 0, 2]);
  });

  it('picks up an earlier class where the character left off', () => {
    const back = switchClass(
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
    const fresh = switchClass(expert4, 'full-warrior', true);
    if (!fresh.ok) throw new Error('switch refused');
    expect(totalAttackBonus(fresh.classes, lookup)).toBe(2);
    expect(levelUp({ current: 'x', levels: {} }).classLevel).toBe(1);
    expect(switchClass({ current: 'x', levels: {} }, 'full-warrior', true)).toEqual({
      ok: false,
      reason: 'current-below-4',
    });
  });
});
