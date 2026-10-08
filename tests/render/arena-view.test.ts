import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/game/combat/battle.ts';
import { createRng } from '../../src/rules/rng.ts';
import {
  conditions,
  outcomeText,
  roundsText,
  sideView,
  slotView,
  type SlotView,
} from '../../src/render/arena-view.ts';
import { data, standardBattle, starter, who } from '../game/combat/helpers.ts';

describe('arena view', () => {
  it('shows HP and every condition on a slot', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    expect(slotView(snag)).toMatchObject({
      label: 'Snag',
      hp: 8,
      maxHp: 8,
      hpPercent: 100,
      ac: 18,
      conditions: [],
      gone: false,
    });
    Object.assign(snag, {
      status: 'dying',
      hp: -2,
      frail: true,
      stunned: true,
      blindRounds: 1,
      wardRounds: 1,
      totalDefense: true,
      instinctive: true,
      acBonus: 4,
      amber: true,
      fleet: true,
      finalDeath: true,
      strain: { strain: 0, max: 10, broken: true },
    });
    expect(slotView(snag).hpPercent).toBe(0);
    expect(conditions(snag)).toEqual([
      'dying',
      'frail',
      'stunned',
      'blind',
      'warded',
      'defending',
      'on instinct',
      'AC +4',
      'frozen in amber',
      'fleet',
      'final death',
      'broken',
    ]);
    for (const [status, tag] of [
      ['asleep', 'asleep'],
      ['stable', 'stable'],
      ['out', 'out of the fight'],
      ['fled', 'fled'],
    ] as const) {
      const thug = { ...who(b, 'foe-0-0'), status };
      expect(conditions(thug)).toEqual([tag]);
      expect(slotView(thug).gone).toBe(status === 'out' || status === 'fled');
    }
    expect(slotView({ ...snag, maxHp: 0 }).hpPercent).toBe(0);
  });

  it('lays the party out in two rows of four', () => {
    const b = standardBattle([['thug-or-militia']]);
    const party = sideView(b, 'party');
    expect(party.title).toBe('The party');
    expect(party.rowNames).toEqual(['Front', 'Rear']);
    expect(party.rows.map((r) => r.map((s) => s?.label ?? null))).toEqual([
      ['Snag', 'Grukk', null, null],
      ['Lirael', 'Fizzwick', null, null],
    ]);
  });

  it('lays monsters out in three rows, keeping the fallen until the living step up', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia'], ['veteran-soldier']]);
    const enemy = sideView(b, 'enemy');
    expect(enemy.rowNames).toEqual(['Front', 'Second', 'Third']);
    expect(enemy.rows.map((r) => r.length)).toEqual([2, 2, 2]);
    who(b, 'foe-0-0').status = 'dead';
    expect(sideView(b, 'enemy').rows[0]?.[0]?.status).toBe('dead');
    who(b, 'foe-1-0').row = 0;
    expect(sideView(b, 'enemy').rows[0]?.[0]?.label).toBe('Veteran Soldier [1-1]');
    const empty = createBattle({ data, rng: createRng('e'), party: [], enemies: [] });
    expect(sideView(empty, 'enemy').rows).toEqual([[null], [null], [null]]);
  });

  it('announces the outcome', () => {
    const b = standardBattle([['thug-or-militia']]);
    expect(outcomeText(b, 'party')).toBe('The party wins.');
    expect(outcomeText(b, 'enemy')).toBe('The enemy wins.');
    expect(outcomeText(b, 'draw')).toBe('The fight is a draw.');
    expect([roundsText(1), roundsText(4)]).toEqual(['1 round', '4 rounds']);
  });

  it('shows a war mount under its rider, not in a slot of its own', () => {
    const b = createBattle({
      data,
      rng: createRng('mount-view'),
      party: [{ character: starter('grukk'), row: 0, column: 2 }],
      mounts: [{ monster: 'war-boar', name: 'Tusker', rider: 0, hp: 9, maxHp: 20 }],
      enemies: [['thug-or-militia']],
    });
    const front = sideView(b, 'party').rows[0] as (SlotView | null)[];
    expect(front.filter((s) => s !== null)).toHaveLength(1);
    expect(front[2]).toMatchObject({
      label: 'Grukk',
      mount: { label: expect.stringContaining('Tusker'), hp: 9 },
    });
  });
});
