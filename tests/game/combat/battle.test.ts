import { describe, expect, it } from 'vitest';
import { monsterAction, partyAction } from '../../../src/game/combat/ai.ts';
import {
  act,
  beginRound,
  createBattle,
  MAX_ROUNDS,
  runBattle,
  runRound,
} from '../../../src/game/combat/battle.ts';
import { checkMorale } from '../../../src/game/combat/morale.ts';
import type { Battle, CasterState, Controller } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, standardBattle, starter, who } from './helpers.ts';

const wait: Controller = () => ({ kind: 'wait' });
const enemies = (b: Battle) => b.combatants.filter((c) => c.side === 'enemy');

describe('monster tactics and Instinct (SRD 5.4)', () => {
  it('attacks the reachable target most likely to drop', () => {
    const b = standardBattle([['thug-or-militia']]);
    who(b, 'Snag').hp = 8;
    who(b, 'Grukk').hp = 2;
    expect(monsterAction(b, who(b, 'foe-0-0'))).toEqual({
      kind: 'attack',
      attack: 0,
      target: 'pc-1',
    });
  });

  it('picks a random reachable target on a failed Instinct check, and waits with none', () => {
    const b = standardBattle([['thug-or-militia'], ['veteran-soldier']]);
    const thug = who(b, 'foe-0-0');
    thug.instinctive = true;
    b.rng = scriptedRng([1]);
    expect(monsterAction(b, thug)).toMatchObject({ target: 'pc-0' });
    expect(monsterAction(b, who(b, 'foe-1-0'))).toEqual({ kind: 'wait' });
  });
});

describe('party auto-combat', () => {
  it('stabilizes a dying ally from the rear before anything else', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    snag.status = 'dying';
    snag.fellRound = 1;
    expect(partyAction(b, who(b, 'Lirael'))).toEqual({ kind: 'stabilize', target: 'pc-0' });
    // A front-row fighter in melee keeps fighting.
    expect(partyAction(b, who(b, 'Grukk'))).toMatchObject({ kind: 'attack' });
  });

  it('sleeps a crowded row, then uses Coffin, Shackles, Stunning Shock, or Elemental Blast', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia'], ['warrior-baron']]);
    const fizz = who(b, 'Fizzwick');
    const caster = fizz.caster as CasterState;
    expect(partyAction(b, fizz)).toEqual({
      kind: 'cast',
      magic: 'the-wind-of-the-final-repose',
      row: 0,
    });
    caster.prepared = ['the-coruscating-coffin'];
    expect(partyAction(b, fizz)).toMatchObject({ magic: 'the-coruscating-coffin', strain: false });
    caster.spellsLeft = 0;
    expect(partyAction(b, fizz)).toMatchObject({ magic: 'the-coruscating-coffin', strain: true });
    caster.known = [];
    caster.prepared = ['ineluctable-shackles-of-volition'];
    caster.spellsLeft = 1;
    expect(partyAction(b, fizz)).toMatchObject({ magic: 'ineluctable-shackles-of-volition' });
    caster.spellsLeft = 0;
    caster.arts.push('stunning-shock', 'elemental-blast');
    expect(partyAction(b, fizz)).toMatchObject({ magic: 'stunning-shock' });
    for (const e of enemies(b)) e.tags.delete('metal');
    expect(partyAction(b, fizz)).toMatchObject({ magic: 'elemental-blast' });
    // Out of magic, the mage throws a dagger from the rear.
    caster.effortUsed = caster.effortMax;
    expect(partyAction(b, fizz)).toMatchObject({ kind: 'attack', attack: 2 });
    caster.canCast = false;
    for (const e of enemies(b)) e.status = 'dead';
    expect(partyAction(b, fizz)).toEqual({ kind: 'wait' });
  });

  it('attacks the weakest target with the best usable attack, or tends the dying if it can’t', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
    who(b, 'foe-0-0').hp = 6;
    who(b, 'foe-0-1').hp = 2;
    expect(partyAction(b, who(b, 'Snag'))).toEqual({
      kind: 'attack',
      attack: 0,
      target: 'foe-0-1',
    });
    expect(partyAction(b, who(b, 'Lirael'))).toEqual({
      kind: 'attack',
      attack: 0,
      target: 'foe-0-1',
    });
    const fizz = who(b, 'Fizzwick');
    (fizz.caster as CasterState).canCast = false;
    expect(partyAction(b, fizz)).toMatchObject({ kind: 'attack', attack: 2 });
    for (const e of enemies(b)) e.status = 'asleep';
    expect(partyAction(b, who(b, 'Snag'))).toMatchObject({ kind: 'attack' });
    const snag = who(b, 'Snag');
    snag.status = 'dying';
    for (const e of enemies(b)) e.status = 'dead';
    expect(partyAction(b, who(b, 'Grukk'))).toEqual({ kind: 'stabilize', target: 'pc-0' });
    b.stabilizedThisRound.add('pc-0');
    expect(partyAction(b, who(b, 'Grukk'))).toEqual({ kind: 'wait' });
  });
});

describe('morale (SRD 5.3, per enemy row)', () => {
  it('checks a row on its first loss, and every row once half the side is down', () => {
    const b = standardBattle([
      ['thug-or-militia', 'thug-or-militia'],
      ['veteran-soldier', 'veteran-soldier'],
    ]);
    const [t1, , v1, v2] = enemies(b);
    if (!t1 || !v1 || !v2) throw new Error('setup');
    checkMorale(b);
    expect(b.rowsChecked.size).toBe(0);
    // Row 1 loses a member and rolls 6 + 6 against Morale 8: it breaks. Half the side is then
    // down, so row 2 checks too: it holds (2 + 2), and each member checks Instinct (3 and 9).
    b.rng = scriptedRng([6, 6, 2, 2, 3, 9]);
    t1.status = 'dead';
    checkMorale(b);
    expect(enemies(b).map((e) => e.status)).toEqual(['dead', 'fled', 'active', 'active']);
    expect([v1.instinctive, v2.instinctive]).toEqual([true, false]);
    checkMorale(b);
  });
});

describe('the battle loop (SRD 2.4.1–2.4.2)', () => {
  it('rejects oversized parties and enemy formations', () => {
    const c = starter('snag');
    const rng = createRng('x');
    expect(() =>
      createBattle({ data, rng, party: Array(9).fill({ character: c }), enemies: [] }),
    ).toThrow();
    expect(() =>
      createBattle({ data, rng, party: [{ character: c }], enemies: [[], [], [], []] }),
    ).toThrow();
    expect(() =>
      createBattle({
        data,
        rng,
        party: [{ character: c }],
        enemies: [Array(9).fill('thug-or-militia')],
      }),
    ).toThrow();
  });

  it('places PCs front then rear, rolls side initiative, and logs only on request', () => {
    const party = (['snag', 'grukk', 'lirael', 'fizzwick', 'snag'] as const).map((f) => ({
      character: starter(f),
    }));
    const b = createBattle({
      data,
      rng: scriptedRng([1, 1, 3, 1, 1, 2]),
      party,
      enemies: [['thug-or-militia']],
    });
    expect(b.combatants.slice(0, 5).map((c) => [c.row, c.column])).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 0],
    ]);
    // Party: 3 + Dex 1 + Alert 1 = 5 against the enemy's 2.
    expect(b.partyFirst).toBe(true);
    expect(b.log).toBeNull();
  });

  it('runs turns: stunned foes lose theirs, Pavis is free, actions resolve', () => {
    const b = standardBattle([['thug-or-militia']]);
    const thug = who(b, 'foe-0-0');
    thug.stunned = true;
    const fizz = who(b, 'Fizzwick');
    (fizz.caster as CasterState).arts.push('pavis-of-elements');
    runRound(b, wait, wait);
    expect(thug.stunned).toBe(false);
    expect(fizz.acBonus).toBe(4);
    expect(b.round).toBe(2);
    act(b, who(b, 'Snag'), { kind: 'total-defense' });
    expect(who(b, 'Snag').totalDefense).toBe(true);
    act(b, fizz, { kind: 'move', row: 1, column: 3 });
    expect([fizz.row, fizz.column]).toEqual([1, 3]);
    // Into an ally's slot is a swap (docs/rules-adaptation.md, Swapping).
    act(b, fizz, { kind: 'move', row: 0, column: 0 });
    expect([fizz.row, fizz.column]).toEqual([0, 0]);
    expect([who(b, 'Snag').row, who(b, 'Snag').column]).toEqual([1, 3]);
    act(b, thug, { kind: 'move', row: 1, column: 0 });
    expect(thug.row).toBe(0);
    act(b, fizz, { kind: 'attack', attack: 9, target: thug.id });
    act(b, fizz, { kind: 'stabilize', target: thug.id });
    act(b, fizz, { kind: 'cast', magic: 'elemental-blast', target: thug.id });
  });

  it('stabilizes the dying with a Heal check at 8 + rounds since the fall (+2 without a kit)', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    const lirael = who(b, 'Lirael');
    snag.status = 'dying';
    snag.fellRound = 1;
    // Lirael: Heal-1, best of Dex or Int +1; 2d6 = 5 + 2 = 7 against 10: fails.
    b.rng = scriptedRng([2, 3]);
    act(b, lirael, { kind: 'stabilize', target: snag.id });
    expect(snag.status).toBe('dying');
    act(b, lirael, { kind: 'stabilize', target: snag.id });
    b.stabilizedThisRound.clear();
    b.rng = scriptedRng([4, 4]);
    act(b, lirael, { kind: 'stabilize', target: snag.id });
    expect(snag).toMatchObject({ status: 'stable', frail: true });
  });

  it('drops a downed front character back and lets enemy rows advance', () => {
    const b = standardBattle([[], ['thug-or-militia']]);
    const snag = who(b, 'Snag');
    snag.status = 'dying';
    snag.fellRound = 1;
    runRound(b, wait, wait);
    expect([snag.row, snag.column]).toEqual([1, 2]);
    expect(who(b, 'foe-1-0').row).toBe(0);
  });

  it('promotes the healthiest rear character when the rear row is full', () => {
    const party = (['snag', 'grukk', 'lirael', 'fizzwick'] as const).map((f, i) => ({
      character: starter(f),
      row: i < 1 ? 0 : 1,
      column: i < 1 ? 0 : i - 1,
    }));
    party.push({ character: starter('snag'), row: 1, column: 3 });
    const b = createBattle({
      data,
      rng: createRng('promote'),
      party,
      enemies: [['thug-or-militia']],
    });
    const front = b.combatants[0];
    if (!front) throw new Error('setup');
    who(b, 'Grukk').hp = 30;
    front.status = 'dying';
    front.fellRound = 1;
    runRound(b, wait, wait);
    const promoted = b.combatants.find((c) => c.side === 'party' && c.row === 0);
    expect(promoted?.name).toBe('Grukk');
    expect([front.row, front.column]).toEqual([1, 0]);
  });

  it('kills the untended dying at the end of the sixth round after they fell', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    snag.status = 'dying';
    snag.fellRound = 1;
    // Fell in round 1: rounds 2–7 are the six after, so death comes at the end of round 7.
    for (let i = 0; i < 6; i++) runRound(b, wait, wait);
    expect(snag.status).toBe('dying');
    runRound(b, wait, wait);
    expect(snag.status).toBe('dead');
  });

  it('ends in a draw after the round limit', () => {
    const b = standardBattle([['thug-or-militia']], createRng('draw'), false);
    expect(runBattle(b, wait, wait)).toMatchObject({ outcome: 'draw', rounds: MAX_ROUNDS });
  });

  it('wins, loses, and keeps tending the fallen after a win', () => {
    const win = standardBattle([['thug-or-militia']], createRng('win'));
    const grukk = who(win, 'Grukk');
    grukk.status = 'dying';
    grukk.fellRound = 1;
    const result = runBattle(win);
    expect(result.outcome).toBe('party');
    expect(['stable', 'dead']).toContain(grukk.status);
    const lose = standardBattle(
      [['great-warrior-king', 'great-warrior-king'], ['legendary-god-titan']],
      createRng('lose'),
      false,
    );
    expect(runBattle(lose)).toMatchObject({ outcome: 'enemy' });
  });

  it('counts blindness and wards down each round', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    snag.blindRounds = 2;
    snag.wardRounds = 1;
    runRound(b, wait, wait);
    expect([snag.blindRounds, snag.wardRounds]).toEqual([1, 0]);
  });

  it('acts first with Alert 2, and rolls Instinct for the enemy in round 2', () => {
    const b = standardBattle([['thug-or-militia']], createRng('alert'));
    const lirael = who(b, 'Lirael');
    lirael.actsFirst = true;
    b.partyFirst = false;
    beginRound(b);
    const order: string[] = [];
    const record: Controller = (_, actor) => {
      order.push(actor.name);
      return { kind: 'wait' };
    };
    runRound(b, record, record);
    expect(order[0]).toBe('Lirael');
    expect(order.at(-1)).toBe('Fizzwick');
    expect(order[1]).toBe('Thug or Militia');
  });
});
