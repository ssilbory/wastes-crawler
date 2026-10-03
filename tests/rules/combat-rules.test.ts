import { describe, expect, it } from 'vitest';
import {
  actsOnInstinct,
  killingBlowBonus,
  moraleHolds,
  partyActsFirst,
  sideInitiative,
  stabilizeDifficulty,
} from '../../src/rules/combat.ts';
import { coverSteps, frontDrops, shielded, type Formation } from '../../src/rules/formation.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

describe('combat checks', () => {
  it('rolls side initiative as 1d8 plus the best Dex modifier, PCs winning ties', () => {
    expect(sideInitiative(scriptedRng([5]), 1)).toBe(6);
    expect(sideInitiative(scriptedRng([5]), 1, 1)).toBe(7);
    expect(partyActsFirst(4, 4)).toBe(true);
    expect(partyActsFirst(3, 4)).toBe(false);
  });

  it('fails Morale on 2d6 over the score and Instinct on 1d10 at or under it', () => {
    expect(moraleHolds(scriptedRng([4, 4]), 8)).toBe(true);
    expect(moraleHolds(scriptedRng([5, 4]), 8)).toBe(false);
    expect(moraleHolds(scriptedRng([6, 6]), 12)).toBe(true);
    expect(actsOnInstinct(scriptedRng([3]), 3)).toBe(true);
    expect(actsOnInstinct(scriptedRng([4]), 3)).toBe(false);
  });

  it('sets the stabilize difficulty and Killing Blow bonus', () => {
    expect(stabilizeDifficulty(0, true)).toBe(8);
    expect(stabilizeDifficulty(3, false)).toBe(13);
    expect(killingBlowBonus(1)).toBe(1);
    expect(killingBlowBonus(4)).toBe(2);
    expect(killingBlowBonus(5)).toBe(3);
  });
});

const up = { standing: true, down: false };
const down = { standing: false, down: true };

describe('formation', () => {
  it('shields a rear slot only while someone stands ahead of it', () => {
    const f: Formation = [
      [up, down, null, up],
      [up, up, up, up],
    ];
    expect([0, 1, 2, 3].map((c) => shielded(f, c))).toEqual([true, false, false, true]);
  });

  it('counts rear-cover disadvantage both ways, and none for flyers', () => {
    expect(coverSteps(false, false)).toBe(0);
    expect(coverSteps(true, false)).toBe(-1);
    expect(coverSteps(true, true)).toBe(-2);
    expect(coverSteps(true, true, true)).toBe(0);
  });

  it('drops a downed front character to an empty rear slot, preferring the one behind', () => {
    const f: Formation = [
      [down, up, up, down],
      [up, null, null, up],
    ];
    expect(frontDrops(f, [5, 0, 0, 5], () => 0)).toEqual([
      { from: [0, 0], to: [1, 1] },
      { from: [0, 3], to: [1, 2] },
    ]);
    const behind: Formation = [
      [up, down, up, up],
      [up, null, up, up],
    ];
    expect(frontDrops(behind, [], () => 0)).toEqual([{ from: [0, 1], to: [1, 1] }]);
  });

  it('promotes the healthiest standing rear character when the rear row is full', () => {
    const f: Formation = [
      [down, up, up, up],
      [up, up, down, up],
    ];
    expect(frontDrops(f, [3, 7, 9, 2], () => 0)).toEqual([{ from: [0, 0], to: [1, 1] }]);
    expect(frontDrops(f, [7, 7, 9, 2], (cols) => cols[1] as number)).toEqual([
      { from: [0, 0], to: [1, 1] },
    ]);
    const allDown: Formation = [
      [down, up, up, up],
      [down, down, down, down],
    ];
    expect(frontDrops(allDown, [0, 0, 0, 0], () => 0)).toEqual([]);
    // Missing HP entries count as 0.
    expect(frontDrops(f, [3], () => 0)).toEqual([{ from: [0, 0], to: [1, 0] }]);
  });
});
