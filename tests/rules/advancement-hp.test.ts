import { describe, expect, it } from 'vitest';
import {
  attributeBoostCost,
  levelForXp,
  skillPointsPerLevel,
  skillRaiseCost,
  xpForLevel,
} from '../../src/rules/advancement.ts';
import { rollMaxHp } from '../../src/rules/hit-points.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

describe('XP', () => {
  it('uses the SRD Fast table, then steps that grow by 3', () => {
    expect([1, 2, 5, 10, 11, 12, 13].map(xpForLevel)).toEqual([0, 3, 18, 93, 117, 144, 174]);
    expect(() => xpForLevel(0)).toThrow();
  });

  it('finds the level for an XP total', () => {
    expect([0, 2, 3, 92, 93, 116, 117, 144].map(levelForXp)).toEqual([1, 1, 2, 9, 10, 10, 11, 12]);
  });
});

describe('skill points and attribute boosts', () => {
  it('gives 3 skill points a level, 4 with Quick Learner', () => {
    expect(skillPointsPerLevel(false)).toBe(3);
    expect(skillPointsPerLevel(true)).toBe(4);
  });

  it('charges by the level bought and gates high levels by character level', () => {
    expect(skillRaiseCost(null, 1)).toEqual({ ok: true, cost: 1 });
    expect(skillRaiseCost(0, 1)).toEqual({ ok: true, cost: 2 });
    expect(skillRaiseCost(1, 2)).toEqual({ ok: false, reason: 'character-level' });
    expect(skillRaiseCost(1, 3)).toEqual({ ok: true, cost: 3 });
    expect(skillRaiseCost(3, 9)).toEqual({ ok: true, cost: 5 });
    expect(skillRaiseCost(4, 20)).toEqual({ ok: false, reason: 'at-maximum' });
  });

  it('charges n points for the nth boost, gated at 3, 6, and 9, five at most', () => {
    expect(attributeBoostCost(0, 1)).toEqual({ ok: true, cost: 1 });
    expect(attributeBoostCost(2, 2)).toEqual({ ok: false, reason: 'character-level' });
    expect(attributeBoostCost(2, 3)).toEqual({ ok: true, cost: 3 });
    expect(attributeBoostCost(3, 5)).toEqual({ ok: false, reason: 'character-level' });
    expect(attributeBoostCost(4, 9)).toEqual({ ok: true, cost: 5 });
    expect(attributeBoostCost(5, 20)).toEqual({ ok: false, reason: 'at-maximum' });
  });
});

describe('rollMaxHp', () => {
  const warriorDie = { count: 1, sides: 6, modifier: 2 };
  const mageDie = { count: 1, sides: 6, modifier: -1 };

  it('adds Con and Die Hard to every die and takes a higher roll', () => {
    const r = rollMaxHp(scriptedRng([3, 5]), {
      dice: [warriorDie, warriorDie],
      conModifier: 1,
      dieHard: true,
      currentMax: 10,
    });
    expect(r).toEqual({ max: 18, rolled: 18, perDie: [8, 10] });
  });

  it('raises the maximum by 1 when the roll is not higher', () => {
    const r = rollMaxHp(scriptedRng([1, 1]), {
      dice: [warriorDie, warriorDie],
      conModifier: 0,
      dieHard: false,
      currentMax: 9,
    });
    expect(r).toMatchObject({ rolled: 6, max: 10 });
  });

  it('never lets a die fall below 1', () => {
    const r = rollMaxHp(scriptedRng([1]), {
      dice: [mageDie],
      conModifier: -2,
      dieHard: false,
      currentMax: 0,
    });
    expect(r).toEqual({ max: 1, rolled: 1, perDie: [1] });
  });
});
