import { describe, expect, it } from 'vitest';
import { act } from '../../../src/game/combat/actions.ts';
import { monsterAction } from '../../../src/game/combat/ai.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import {
  bound,
  followUpBonus,
  noteHit,
  selfHeal,
  specialAction,
  spinWeb,
  squeeze,
  startTurn,
  tearFree,
} from '../../../src/game/combat/creature-specials.ts';
import { checkMorale } from '../../../src/game/combat/morale.ts';
import { currentActor, takeTurn } from '../../../src/game/combat/round.ts';
import type { Attack, Battle, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng, scriptedThen } from '../../helpers/scripted-rng.ts';
import { data, standardBattle, who } from './helpers.ts';

// docs/rules-adaptation.md, Creature specials in Phase 19.
const foe = (b: Battle) => b.combatants.find((c) => c.side === 'enemy') as Combatant;
const strike = (c: Combatant, name: string) => c.attacks.find((a) => a.name === name) as Attack;
const log = (b: Battle) => b.log?.join(' ') ?? '';

/** Snag with the given Exert and Punch and a Str modifier of 0. */
function strong(b: Battle, exert: number | null, punch: number | null): Combatant {
  const snag = who(b, 'Snag');
  snag.skills = {
    ...(exert === null ? {} : { exert }),
    ...(punch === null ? {} : { punch }),
  };
  snag.modifiers = { ...snag.modifiers, str: 0 };
  return snag;
}

describe("the vampire's regeneration", () => {
  it('knits 3 hit points at the start of each turn, never past its maximum', () => {
    const b = standardBattle([['vampire']]);
    const v = foe(b);
    v.turnHits = [{ strike: 'x', target: 'y' }];
    v.hp = v.maxHp - 5;
    startTurn(b, v);
    expect(v.hp).toBe(v.maxHp - 2);
    expect(v.turnHits).toEqual([]);
    startTurn(b, v);
    expect(v.hp).toBe(v.maxHp);
    startTurn(b, v);
    expect(log(b).match(/wounds knit/g)).toHaveLength(2);
    const snag = who(b, 'Snag');
    snag.hp = 1;
    startTurn(b, snag);
    expect(snag.hp).toBe(1);
  });
});

describe("the black widow's webs", () => {
  it('are cast once, at the first standing foe in the front row', () => {
    const b = standardBattle([['giant-black-widow']]);
    const widow = foe(b);
    expect(specialAction(b, widow)).toEqual({ kind: 'web', target: 'pc-0' });
    who(b, 'Snag').webbed = 8;
    expect(specialAction(b, widow)).toEqual({ kind: 'web', target: 'pc-1' });
    who(b, 'Grukk').status = 'dead';
    expect(specialAction(b, widow)).toBeNull();
  });

  it('catch a foe who fails the save, as the whole Main Action', () => {
    const b = standardBattle([['giant-black-widow']]);
    const widow = foe(b);
    const snag = who(b, 'Snag');
    b.rng = scriptedRng([20]);
    spinWeb(b, widow, snag);
    expect([snag.webbed, widow.webs]).toEqual([0, null]);
    expect(log(b)).toContain('dodges');
    spinWeb(b, widow, snag);
    const c = standardBattle([['giant-black-widow']]);
    c.rng = scriptedThen([1], createRng('web'));
    takeTurn(c, foe(c), monsterAction);
    expect(who(c, 'Snag').webbed).toBe(8);
    expect(who(c, 'Snag').hp).toBe(who(c, 'Snag').maxHp);
    spinWeb(c, foe(c), undefined);
  });

  it('hold a foe until a Str/Exert check against 8 tears it free', () => {
    const b = standardBattle([['giant-black-widow']]);
    const snag = strong(b, 1, null);
    snag.webbed = 8;
    expect(bound(b, snag)).toBe(true);
    b.rng = scriptedRng([3, 3]);
    tearFree(b, snag);
    expect(snag.webbed).toBe(8);
    b.rng = scriptedRng([3, 4]);
    tearFree(b, snag);
    expect(snag.webbed).toBe(0);
    expect(bound(b, snag)).toBe(false);
    // Broken, the check is made at a step of disadvantage: 6, 6, and 1, keeping 1 + 6.
    snag.webbed = 8;
    snag.strain = { strain: 0, max: 10, broken: true };
    b.rng = scriptedRng([6, 6, 1]);
    tearFree(b, snag);
    expect(snag.webbed).toBe(0);
    // A monster tears free with its skill bonus.
    const widow = foe(b);
    widow.webbed = 8;
    b.rng = scriptedRng([3, 4]);
    tearFree(b, widow);
    expect(widow.webbed).toBe(0);
  });

  it('take the turn of the webbed for struggling', () => {
    const b = standardBattle([['giant-black-widow']]);
    const snag = strong(b, null, null);
    snag.webbed = 8;
    b.queue = [snag.id, foe(b).id];
    b.rng = scriptedRng([1, 1]);
    expect(currentActor(b)).toBe(foe(b));
    expect(log(b)).toContain('Snag struggles in the webs.');
    // Stunned as well, the stun takes the turn and the webs stay.
    snag.stunned = true;
    b.queue = [snag.id];
    expect(currentActor(b)).toBeNull();
    expect([snag.stunned, snag.webbed]).toEqual([false, 8]);
  });
});

describe("the unicorn's horn and blink", () => {
  it('heals it 2d6 once, at half its hit points or less', () => {
    const b = standardBattle([['unicorn']]);
    const u = foe(b);
    u.maxHp = 20;
    u.hp = 11;
    expect(specialAction(b, u)).toBeNull();
    u.hp = 10;
    expect(specialAction(b, u)).toEqual({ kind: 'self-heal' });
    b.rng = scriptedRng([6, 6]);
    act(b, u, { kind: 'self-heal' });
    expect([u.hp, u.selfHeal]).toEqual([20, null]);
    u.hp = 2;
    selfHeal(b, u);
    expect(u.hp).toBe(2);
    expect(specialAction(b, u)).toBeNull();
  });

  it('gets away when its row breaks, even from foes who outnumber it', () => {
    const b = standardBattle([['unicorn', 'unicorn']]);
    const [u1, u2] = b.combatants.filter((c) => c.side === 'enemy') as [Combatant, Combatant];
    u1.status = 'dead';
    b.rng = scriptedRng([6, 6]);
    checkMorale(b);
    expect(u2).toMatchObject({ status: 'fled', surrendered: false });
    expect(log(b)).toContain('blinks out of sight');
  });
});

describe("the bears' hug", () => {
  it('holds a foe both claws hit in one turn', () => {
    const b = standardBattle([['cave-bear']]);
    const bear = foe(b);
    const [snag, grukk] = [who(b, 'Snag'), who(b, 'Grukk')];
    const claw = strike(bear, 'Claw');
    noteHit(b, bear, claw, snag);
    expect(snag.heldBy).toBeNull();
    noteHit(b, bear, strike(bear, 'Bite'), snag);
    noteHit(b, bear, claw, grukk);
    expect([snag.heldBy, grukk.heldBy]).toEqual([null, null]);
    noteHit(b, bear, claw, snag);
    expect(snag.heldBy).toBe(bear.id);
    expect(log(b)).toContain('crushing hug');
    // One at a time, and never one already held or down.
    startTurn(b, bear);
    noteHit(b, bear, claw, grukk);
    noteHit(b, bear, claw, grukk);
    expect(grukk.heldBy).toBeNull();
    snag.heldBy = null;
    snag.status = 'dead';
    noteHit(b, bear, claw, snag);
    expect(snag.heldBy).toBeNull();
    // A creature with no hug only counts its hits.
    const c = standardBattle([['thug-or-militia']]);
    noteHit(c, foe(c), foe(c).attacks[0] as Attack, who(c, 'Snag'));
    expect(foe(c).turnHits).toHaveLength(1);
  });

  it('crushes the held at the end of each round until either falls', () => {
    const b = standardBattle([['cave-bear']]);
    const bear = foe(b);
    const snag = who(b, 'Snag');
    snag.hp = 20;
    snag.heldBy = bear.id;
    b.rng = scriptedRng([3, 4]);
    squeeze(b);
    expect(snag.hp).toBe(13);
    bear.status = 'dead';
    squeeze(b);
    expect(snag.heldBy).toBeNull();
    snag.heldBy = bear.id;
    expect(bound(b, snag)).toBe(false);
    bear.status = 'active';
    snag.heldBy = bear.id;
    snag.status = 'dead';
    squeeze(b);
    expect(snag.heldBy).toBeNull();
  });

  it('breaks on an opposed Str/Punch check at -4, the PC winning ties', () => {
    const b = standardBattle([['cave-bear']]);
    const bear = foe(b);
    const snag = strong(b, null, 2);
    snag.heldBy = bear.id;
    // Snag 6 + 6 + 2 - 4 = 10 against the bear's 4 + 5 + 1 = 10: a tie, and Snag breaks free.
    b.rng = scriptedRng([6, 6, 4, 5]);
    tearFree(b, snag);
    expect(snag.heldBy).toBeNull();
    snag.heldBy = bear.id;
    b.rng = scriptedRng([1, 1, 6, 6]);
    tearFree(b, snag);
    expect(snag.heldBy).toBe(bear.id);
    expect(log(b)).toContain('Snag struggles in the hug.');
  });

  it('holds a monster that only ties', () => {
    const b = createBattle({
      data,
      rng: createRng('hug'),
      party: [],
      allies: [['thug-or-militia']],
      enemies: [['cave-bear']],
    });
    const thug = b.combatants.find((c) => c.side === 'party') as Combatant;
    thug.heldBy = foe(b).id;
    // 6 + 6 + 1 - 4 = 9 against 3 + 5 + 1 = 9.
    b.rng = scriptedRng([6, 6, 3, 5]);
    tearFree(b, thug);
    expect(thug.heldBy).toBe(foe(b).id);
  });
});

describe("the scorpion's sting", () => {
  it('gets +2 once a claw has hit this turn', () => {
    const b = standardBattle([['giant-scorpion']]);
    const s = foe(b);
    const sting = strike(s, 'Sting');
    expect(followUpBonus(s, sting)).toBe(0);
    noteHit(b, s, strike(s, 'Claw'), who(b, 'Snag'));
    expect(followUpBonus(s, sting)).toBe(2);
    expect(followUpBonus(s, strike(s, 'Claw'))).toBe(0);
    expect(followUpBonus(who(b, 'Snag'), sting)).toBe(0);
  });
});
