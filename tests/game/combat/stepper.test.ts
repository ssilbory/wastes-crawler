import { describe, expect, it } from 'vitest';
import {
  act,
  advance,
  concludeBattle,
  createBattle,
  currentActor,
  runBattle,
  takeTurn,
} from '../../../src/game/combat/battle.ts';
import { checkMorale } from '../../../src/game/combat/morale.ts';
import { covered, exposed, targets } from '../../../src/game/combat/targeting.ts';
import type { Attack, Battle, Controller } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, standardBattle, starter, who } from './helpers.ts';

const wait: Controller = () => ({ kind: 'wait' });
const isPc = (c: { kind: string }) => c.kind === 'pc';

function duel(seed = 'duel'): Battle {
  return createBattle({
    data,
    rng: createRng(seed),
    party: [],
    allies: [['veteran-soldier', 'veteran-soldier'], ['thug-or-militia']],
    enemies: [['thug-or-militia', 'thug-or-militia']],
    sideNames: { party: 'the left side', enemy: 'the right side' },
    log: true,
  });
}

describe('stepping through turns', () => {
  it('stops at each PC awaiting a command, and resumes after it', () => {
    const b = standardBattle([['thug-or-militia']]);
    b.partyFirst = true;
    const snag = advance(b, isPc, wait, wait);
    if (!snag) throw new Error('no PC turn');
    expect(snag.name).toBe('Snag');
    expect(b.turnBegun).toBe(snag.id);
    // Asking again doesn't restart the turn.
    expect(advance(b, isPc, wait, wait)).toBe(snag);
    takeTurn(b, snag, wait);
    expect(b.turnBegun).toBeNull();
    expect(currentActor(b)?.name).toBe('Grukk');
  });

  it('carries on into the next round', () => {
    const b = standardBattle([['thug-or-militia']]);
    const onlySnag = (c: { name: string }) => c.name === 'Snag';
    const snag = advance(b, onlySnag, wait, wait);
    if (!snag) throw new Error('no PC turn');
    takeTurn(b, snag, wait);
    expect(advance(b, onlySnag, wait, wait)).toBe(snag);
    expect(b.round).toBe(2);
  });

  it('spends a stunned PC’s turn without asking, and plays monsters itself', () => {
    const b = standardBattle([['thug-or-militia']]);
    who(b, 'Snag').stunned = true;
    who(b, 'Snag').totalDefense = true;
    expect(advance(b, (c) => c.name === 'Grukk', wait, wait)?.name).toBe('Grukk');
    expect(who(b, 'Snag')).toMatchObject({ stunned: false, totalDefense: false });
    expect(b.log).toContain('Round 1: Snag is stunned and loses the action.');
  });

  it('returns null once the battle ends, and concludes it', () => {
    const b = standardBattle([['thug-or-militia']]);
    who(b, 'foe-0-0').hp = 1;
    expect(advance(b, () => false)).toBeNull();
    expect(concludeBattle(b)).toMatchObject({ outcome: 'party', deaths: 0 });
    expect(concludeBattle({ ...b, outcome: null }).outcome).toBe('draw');
  });
});

describe('monster vs monster', () => {
  it('lines both sides up in monster rows and names them', () => {
    const b = duel();
    expect(b.layout).toEqual({ party: 'rows', enemy: 'rows' });
    expect(b.combatants.map((c) => c.id)).toEqual([
      'ally-0-0',
      'ally-0-1',
      'ally-1-0',
      'foe-0-0',
      'foe-0-1',
    ]);
    expect(b.startCount).toEqual({ party: 3, enemy: 2 });
    expect(b.log?.[0]).toMatch(/^Round 1: The (left|right) side wins initiative\.$/);
  });

  it('rejects a side of both characters and monsters, and oversized rows', () => {
    const base = { data, rng: createRng('x'), enemies: [['thug-or-militia']] };
    expect(() =>
      createBattle({
        ...base,
        party: [{ character: starter('snag') }],
        allies: [['thug-or-militia']],
      }),
    ).toThrow('a side is either characters or monsters');
    expect(() =>
      createBattle({ ...base, party: [], allies: [Array(9).fill('thug-or-militia')] }),
    ).toThrow('monsters stand in up to three rows of up to eight');
  });

  it('covers back rows, reaches only front rows, and checks Morale on both sides', () => {
    const b = duel();
    const back = who(b, 'ally-1-0');
    expect(covered(b, back)).toBe(true);
    expect(exposed(b, back)).toBe(false);
    const thug = who(b, 'foe-0-0');
    expect(targets(b, thug, thug.attacks[0] as Attack).map((t) => t.id)).toEqual([
      'ally-0-0',
      'ally-0-1',
    ]);
    who(b, 'ally-0-0').status = 'dead';
    b.rng = createRng('morale');
    checkMorale(b);
    expect(b.rowsChecked.has('party:0')).toBe(true);
    expect(b.rowsChecked.has('enemy:0')).toBe(false);
  });

  it('advances a side’s rows when its front row falls, and fights to an outcome', () => {
    const b = duel();
    who(b, 'ally-0-0').status = 'dead';
    who(b, 'ally-0-1').status = 'dead';
    const result = runBattle(b, wait, wait);
    expect(who(b, 'ally-1-0').row).toBe(0);
    expect(['party', 'enemy', 'draw']).toContain(result.outcome);
  });
});

describe('moving rows', () => {
  it('moves a PC to an empty formation slot, and refuses anything else', () => {
    const b = standardBattle([['thug-or-militia']]);
    const lirael = who(b, 'Lirael');
    act(b, lirael, { kind: 'move', row: 0, column: 0 });
    act(b, lirael, { kind: 'move', row: 2, column: 0 });
    act(b, lirael, { kind: 'move', row: 0, column: 4 });
    act(b, lirael, { kind: 'move', row: 0, column: -1 });
    expect([lirael.row, lirael.column]).toEqual([1, 0]);
    act(b, lirael, { kind: 'move', row: 0, column: 2 });
    expect([lirael.row, lirael.column]).toEqual([0, 2]);
    expect(b.log?.at(-1)).toBe('Round 1: Lirael moves to the front row.');
    act(b, lirael, { kind: 'move', row: 1, column: 3 });
    expect(b.log?.at(-1)).toBe('Round 1: Lirael moves to the rear row.');
    const d = duel();
    const vet = who(d, 'ally-0-0');
    act(d, vet, { kind: 'move', row: 1, column: 1 });
    expect([vet.row, vet.column]).toEqual([0, 0]);
  });
});
