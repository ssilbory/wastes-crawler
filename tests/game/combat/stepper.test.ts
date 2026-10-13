import { describe, expect, it } from 'vitest';
import {
  act,
  advance,
  beginRound,
  concludeBattle,
  createBattle,
  currentActor,
  holdTurn,
  runBattle,
  takeTurn,
} from '../../../src/game/combat/battle.ts';
import { commandsFor } from '../../../src/game/combat/commands.ts';
import { defaultAction } from '../../../src/game/combat/defaults.ts';
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
  it('moves a PC to an empty formation slot, and refuses anything off the formation', () => {
    const b = standardBattle([['thug-or-militia']]);
    const lirael = who(b, 'Lirael');
    act(b, lirael, { kind: 'move', row: 1, column: 0 });
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

describe('swapping (docs/rules-adaptation.md, Swapping)', () => {
  it('trades places with an ally, standing or down, for the mover’s action alone', () => {
    const b = standardBattle([['thug-or-militia']]);
    const [snag, lirael] = [who(b, 'Snag'), who(b, 'Lirael')];
    act(b, lirael, { kind: 'move', row: 0, column: 0 });
    expect([lirael.row, lirael.column, snag.row, snag.column]).toEqual([0, 0, 1, 0]);
    expect(b.log?.at(-1)).toBe('Round 1: Lirael trades places with Snag.');
    // A downed front-liner is pulled back the same way.
    const grukk = who(b, 'Grukk');
    grukk.status = 'dying';
    const fizz = who(b, 'Fizzwick');
    act(b, fizz, { kind: 'move', row: 0, column: 1 });
    expect([fizz.row, grukk.row, grukk.column]).toEqual([0, 1, 1]);
    expect(commandsFor(b, fizz).find((c) => c.key === 'move')?.choices).toContainEqual(
      expect.objectContaining({ label: 'Rear row, slot 2: trade places with Grukk' }),
    );
  });
});

describe('holding (docs/rules-adaptation.md, Holding)', () => {
  it('moves the turn to right after the one named, once a round', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
    const snag = who(b, 'Snag');
    b.queue = ['pc-0', 'pc-1', 'foe-0-0', 'foe-0-1'];
    const hold = commandsFor(b, snag).find((c) => c.key === 'hold');
    expect(hold?.choices.map((c) => c.label)).toEqual([
      'After Grukk',
      'After Thug or Militia [1-1]',
      'After Thug or Militia [1-2]',
    ]);
    expect(holdTurn(b, snag, 'foe-0-0')).toBe(true);
    expect(b.queue).toEqual(['pc-1', 'foe-0-0', 'pc-0', 'foe-0-1']);
    expect(b.log?.at(-1)).toBe('Round 1: Snag holds, waiting on Thug or Militia.');
    // Not twice a round, not out of turn, and only for someone still to act.
    b.queue = ['pc-0', 'foe-0-1'];
    expect(holdTurn(b, snag, 'foe-0-1')).toBe(false);
    expect(commandsFor(b, snag).some((c) => c.key === 'hold')).toBe(false);
    const grukk = who(b, 'Grukk');
    expect(holdTurn(b, grukk, 'foe-0-1')).toBe(false);
    b.queue = ['pc-1', 'foe-0-1'];
    expect(holdTurn(b, grukk, 'pc-1')).toBe(false);
    expect(holdTurn(b, grukk, 'nobody')).toBe(false);
    // A new round lets everyone hold again.
    beginRound(b);
    expect(b.heldThisRound.size).toBe(0);
  });

  it('skips those who can no longer act, and offers nothing to the last to act', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    b.queue = ['pc-0', 'pc-1', 'foe-0-0'];
    who(b, 'Grukk').status = 'dying';
    expect(commandsFor(b, snag).find((c) => c.key === 'hold')?.choices).toHaveLength(1);
    b.queue = ['pc-0'];
    expect(commandsFor(b, snag).some((c) => c.key === 'hold')).toBe(false);
  });

  it('takes On Turn actions once, and is never a default or wasted as an action', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    b.queue = ['pc-0', 'foe-0-0'];
    const actor = advance(b, (c) => c.kind === 'pc');
    expect(actor?.id).toBe('pc-0');
    holdTurn(b, snag, 'foe-0-0');
    const before = b.log?.length ?? 0;
    act(b, snag, { kind: 'hold', after: 'foe-0-0' });
    expect(b.log?.length).toBe(before);
    expect(defaultAction(b, snag, 'repeat', { kind: 'hold', after: 'foe-0-0' }).kind).not.toBe(
      'hold',
    );
  });
});
