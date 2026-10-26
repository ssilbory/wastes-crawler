import { describe, expect, it } from 'vitest';
import { netSteps, roll2d6WithEdge, rollD20WithEdge } from '../../src/rules/advantage.ts';
import {
  attributeModifier,
  bestModifier,
  boostedModifier,
  type AttributeScores,
} from '../../src/rules/attributes.ts';
import {
  aidBonus,
  npcCheck,
  pcWinsOpposed,
  pushCheck,
  skillCheck,
  type SkillCheckInput,
} from '../../src/rules/checks.ts';
import { npcSaveTarget, pcSaveTarget, rollSave } from '../../src/rules/saves.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

const scores = (s: Partial<AttributeScores>): AttributeScores => ({
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  ...s,
});

describe('attributeModifier', () => {
  it('follows the SRD bands and clamps outside 3–18', () => {
    expect([1, 3, 4, 7, 8, 13, 14, 17, 18, 20].map(attributeModifier)).toEqual([
      -2, -2, -1, -1, 0, 0, 1, 1, 2, 2,
    ]);
  });

  it('throws on a missing score rather than passing it as the best modifier', () => {
    expect(() => attributeModifier(Number.NaN)).toThrow('not an attribute score: NaN');
    expect(() => attributeModifier(undefined as unknown as number)).toThrow(
      'not an attribute score: undefined',
    );
  });

  it('picks the best of several attributes', () => {
    expect(bestModifier(scores({ str: 18, con: 4 }), ['str', 'con'])).toBe(2);
    expect(boostedModifier(18, 1)).toBe(3);
    expect(boostedModifier(18, 2)).toBe(3);
    expect(boostedModifier(7, 1)).toBe(0);
    expect(boostedModifier(10)).toBe(0);
  });
});

describe('advantage', () => {
  it('cancels one for one and caps at two steps', () => {
    expect(netSteps([])).toBe(0);
    expect(netSteps([1, -1, 1])).toBe(1);
    expect(netSteps([1, 1, 1])).toBe(2);
    expect(netSteps([-1, -1, -1, 1])).toBe(-2);
  });

  it('adds d6s to a d20 for advantage and subtracts them for disadvantage', () => {
    expect(rollD20WithEdge(scriptedRng([12]), 0)).toEqual({ natural: 12, edgeDice: [], total: 12 });
    expect(rollD20WithEdge(scriptedRng([12, 3, 4]), 2).total).toBe(19);
    expect(rollD20WithEdge(scriptedRng([12, 5]), -1).total).toBe(7);
  });

  it('keeps the best or worst two of the 2d6 pool', () => {
    expect(roll2d6WithEdge(scriptedRng([2, 5]), 0)).toEqual({
      dice: [2, 5],
      kept: [5, 2],
      total: 7,
    });
    expect(roll2d6WithEdge(scriptedRng([1, 6, 4, 2]), 2).total).toBe(10);
    expect(roll2d6WithEdge(scriptedRng([1, 6, 4]), -1).total).toBe(5);
  });
});

describe('skill checks', () => {
  const base: SkillCheckInput = { skill: 1, attributeModifier: 1, difficulty: 8 };

  it('succeeds on equal or higher', () => {
    expect(skillCheck(scriptedRng([3, 3]), base)).toMatchObject({ score: 8, success: true });
    expect(skillCheck(scriptedRng([3, 2]), base)).toMatchObject({ score: 7, success: false });
  });

  it('applies the untrained penalty, modifiers, and advantage', () => {
    expect(skillCheck(scriptedRng([4, 4]), { ...base, skill: null }).score).toBe(8);
    expect(skillCheck(scriptedRng([4, 4]), { ...base, modifier: -2 }).score).toBe(8);
    expect(skillCheck(scriptedRng([1, 1, 6]), { ...base, steps: 1 }).score).toBe(9);
  });

  it('rolls NPC checks with the stat line bonus', () => {
    expect(npcCheck(scriptedRng([4, 3]), { skillBonus: 1, difficulty: 8 }).success).toBe(true);
    expect(
      npcCheck(scriptedRng([4, 3]), { skillBonus: -1, difficulty: 8, modifier: 1, steps: 0 }),
    ).toMatchObject({ score: 7, success: false });
  });

  it('gives ties to the PC and caps aid at +1', () => {
    expect(pcWinsOpposed(8, 8)).toBe(true);
    expect(pcWinsOpposed(7, 8)).toBe(false);
    expect(aidBonus([])).toBe(0);
    expect(aidBonus([false, false])).toBe(0);
    expect(aidBonus([true, true])).toBe(1);
  });
});

describe('push', () => {
  const input: SkillCheckInput = { skill: 0, attributeModifier: 0, difficulty: 8 };
  const failed = skillCheck(scriptedRng([2, 2]), input);

  it('rerolls a failed check for one strain', () => {
    const r = pushCheck(scriptedRng([5, 4]), input, failed, { strain: 0, max: 10, broken: false });
    expect(r).toMatchObject({
      kind: 'pushed',
      result: { success: true, pushed: true },
      strain: { strain: 1 },
    });
  });

  it('breaks the character when the push reaches maximum strain', () => {
    const r = pushCheck(scriptedRng([1, 1]), input, failed, { strain: 9, max: 10, broken: false });
    expect(r).toMatchObject({ kind: 'pushed', strain: { strain: 10, broken: true } });
  });

  it('allows only one push per check, and the breaking reroll is not at disadvantage', () => {
    const first = pushCheck(scriptedRng([1, 2]), input, failed, {
      strain: 9,
      max: 10,
      broken: false,
    });
    if (first.kind !== 'pushed') throw new Error('push refused');
    expect(first.result).toMatchObject({ dice: [1, 2], success: false, pushed: true });
    expect(first.strain.broken).toBe(true);
    expect(
      pushCheck(scriptedRng([]), input, first.result, { strain: 0, max: 10, broken: false }),
    ).toEqual({
      kind: 'refused',
      reason: 'already-pushed',
    });
  });

  it('refuses when Broken, at maximum strain, or when the check succeeded', () => {
    const rng = scriptedRng([]);
    expect(pushCheck(rng, input, failed, { strain: 3, max: 10, broken: true })).toEqual({
      kind: 'refused',
      reason: 'broken',
    });
    expect(pushCheck(rng, input, failed, { strain: 10, max: 10, broken: false })).toEqual({
      kind: 'refused',
      reason: 'over-max',
    });
    const passed = skillCheck(scriptedRng([6, 6]), input);
    expect(pushCheck(rng, input, passed, { strain: 0, max: 10, broken: false })).toEqual({
      kind: 'refused',
      reason: 'not-failed',
    });
  });
});

describe('saves', () => {
  it('computes PC targets from level and the best modifier, with a 2+ floor', () => {
    const s = scores({ str: 14, con: 18, dex: 4, int: 3, wis: 10, cha: 14 });
    expect(pcSaveTarget(1, s, 'physical')).toBe(13);
    expect(pcSaveTarget(1, s, 'evasion')).toBe(16);
    expect(pcSaveTarget(1, s, 'mental')).toBe(14);
    expect(pcSaveTarget(1, s, 'luck')).toBe(15);
    // Developed Attribute: +1 to a modifier, never past +3.
    expect(pcSaveTarget(1, s, 'evasion', { dex: 1 })).toBe(15);
    expect(pcSaveTarget(1, scores({ str: 18 }), 'physical', { str: 2 })).toBe(12);
    expect(pcSaveTarget(10, s, 'luck')).toBe(6);
    expect(pcSaveTarget(15, s, 'physical')).toBe(2);
  });

  it('computes NPC targets as 15 minus half HD, with a 2+ floor', () => {
    expect(npcSaveTarget(1)).toBe(15);
    expect(npcSaveTarget(3)).toBe(14);
    expect(npcSaveTarget(30)).toBe(2);
  });

  it('always fails on a natural 1 and always succeeds on a natural 20', () => {
    expect(rollSave(scriptedRng([1, 6, 6]), 2, { steps: 2 }).success).toBe(false);
    expect(rollSave(scriptedRng([20, 6, 6]), 30, { steps: -2 }).success).toBe(true);
  });

  it('otherwise compares the total with the target', () => {
    expect(rollSave(scriptedRng([10]), 12, { modifier: 2 })).toMatchObject({
      score: 12,
      success: true,
    });
    expect(rollSave(scriptedRng([10]), 12)).toMatchObject({ score: 10, success: false });
    expect(rollSave(scriptedRng([10, 3]), 12, { steps: -1 }).success).toBe(false);
  });
});
