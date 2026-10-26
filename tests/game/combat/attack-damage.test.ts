import { describe, expect, it } from 'vitest';
import { resolveAttack } from '../../../src/game/combat/attack.ts';
import { effectiveAc, harm } from '../../../src/game/combat/damage.ts';
import { save } from '../../../src/game/combat/saves.ts';
import type { Attack, Battle } from '../../../src/game/combat/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { standardBattle, who } from './helpers.ts';

function setup(faces: number[]) {
  const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
  b.rng = scriptedRng(faces);
  b.log = [];
  b.events = [];
  const snag = who(b, 'Snag');
  const thug = who(b, 'foe-0-0');
  thug.hp = 10;
  return { b, snag, thug, spear: snag.attacks[0] as Attack, thugSpear: thug.attacks[0] as Attack };
}
const last = (b: Battle) => b.log?.at(-1);

describe('resolveAttack (SRD 2.4.5–2.4.6)', () => {
  it('hits on d20 + bonus at or over AC and rolls damage', () => {
    const { b, snag, thug, spear } = setup([15, 4]);
    resolveAttack(b, snag, spear, thug);
    expect(thug.hp).toBe(3);
    expect(last(b)).toBe('Round 1: Snag hits Thug or Militia with Spear, Light for 7.');
  });

  it('raises a weak hit to the Shock a miss would deal, unless a ready shield would soak it', () => {
    // Spear 1 + 3 is 4; a miss would deal its Shock of 5, so the hit does 5.
    const { b, snag, thug, spear } = setup([15, 1]);
    resolveAttack(b, snag, spear, thug);
    expect(thug.hp).toBe(5);
    // A shield the bearer hasn't used this round would have soaked that Shock: the hit does 4,
    // and the shield is still ready, as nothing was soaked.
    thug.hp = 10;
    Object.assign(thug, { shield: true, shieldUsed: false });
    b.rng = scriptedRng([15, 1]);
    resolveAttack(b, snag, spear, thug);
    expect([thug.hp, thug.shieldUsed]).toEqual([6, false]);
  });

  it('deals Shock on a melee miss when the target’s AC allows it', () => {
    const { b, snag, thug, spear } = setup([2]);
    resolveAttack(b, snag, spear, thug);
    expect(thug.hp).toBe(5);
    thug.ac = 15;
    b.rng = scriptedRng([2]);
    resolveAttack(b, snag, spear, thug);
    expect(thug.hp).toBe(5);
    expect(last(b)).toBe('Round 1: Snag misses Thug or Militia.');
    // Thrown attacks never deal Shock.
    b.rng = scriptedRng([2]);
    resolveAttack(b, snag, snag.attacks[1] as Attack, thug);
    expect(thug.hp).toBe(5);
  });

  it('lets a shield soak the first Shock each round, and Total Defense block it', () => {
    const { b, snag, thug, thugSpear } = setup([1, 1]);
    snag.ac = 12;
    snag.hp = 8;
    resolveAttack(b, thug, thugSpear, snag);
    expect(snag).toMatchObject({ hp: 8, shieldUsed: true });
    resolveAttack(b, thug, thugSpear, snag);
    expect(snag.hp).toBe(6);
    snag.totalDefense = true;
    expect(effectiveAc(snag)).toBe(14);
    b.rng = scriptedRng([1]);
    resolveAttack(b, thug, thugSpear, snag);
    expect(snag.hp).toBe(6);
  });

  it('checks a ward with the attacker’s Physical save', () => {
    const { b, snag, thug, thugSpear } = setup([19, 5]);
    snag.wardRounds = 1;
    resolveAttack(b, thug, thugSpear, snag);
    expect(last(b)).toContain('slides off the ward');
    b.rng = scriptedRng([19, 16, 3]);
    snag.hp = 8;
    resolveAttack(b, thug, thugSpear, snag);
    expect(snag.hp).toBe(5);
  });

  it('spends Veteran’s Luck to turn a hit that would drop the Warrior', () => {
    const { b, snag, thug, thugSpear } = setup([19, 6]);
    snag.hp = 3;
    resolveAttack(b, thug, thugSpear, snag);
    expect(snag).toMatchObject({ hp: 3, veteransLuck: false });
    b.rng = scriptedRng([19, 6]);
    resolveAttack(b, thug, thugSpear, snag);
    expect(snag).toMatchObject({ hp: 0, status: 'dying', fellRound: 1 });
  });
});

describe('battle events (docs/presentation-plan.md, V3)', () => {
  it('records each blow: a hit, Shock on a miss, a clean miss, and a blow turned aside', () => {
    const { b, snag, thug, spear, thugSpear } = setup([15, 4, 2]);
    resolveAttack(b, snag, spear, thug);
    thug.hp = 10;
    resolveAttack(b, snag, spear, thug);
    thug.ac = 15;
    b.rng = scriptedRng([2, 1]);
    resolveAttack(b, snag, spear, thug);
    snag.ac = 12;
    resolveAttack(b, thug, thugSpear, snag);
    b.rng = scriptedRng([19, 5]);
    snag.wardRounds = 1;
    resolveAttack(b, thug, thugSpear, snag);
    expect(b.events).toEqual([
      { kind: 'hit', actor: snag.id, target: thug.id, amount: 7 },
      { kind: 'shock', actor: snag.id, target: thug.id, amount: 5 },
      { kind: 'miss', actor: snag.id, target: thug.id, amount: 0 },
      { kind: 'turned', actor: thug.id, target: snag.id, amount: 0 },
      { kind: 'turned', actor: thug.id, target: snag.id, amount: 0 },
    ]);
  });

  it('keeps none without a log', () => {
    const b = standardBattle([['thug-or-militia']], undefined, false);
    expect(b.events).toBeNull();
    resolveAttack(b, who(b, 'Snag'), who(b, 'Snag').attacks[0] as Attack, who(b, 'foe-0-0'));
    expect(b.events).toBeNull();
  });
});

describe('harm and saves (SRD 2.5.1)', () => {
  it('kills monsters and Frail PCs at 0 HP, and finishes the dying', () => {
    const { b, snag, thug } = setup([]);
    harm(b, thug, 0);
    expect(thug.hp).toBe(10);
    harm(b, thug, 12);
    expect(thug).toMatchObject({ hp: 0, status: 'dead' });
    snag.frail = true;
    harm(b, snag, 99);
    expect(snag.status).toBe('dead');
    const grukk = who(b, 'Grukk');
    grukk.selfStabilize = false; // Without Die Hard, to fall as anyone does.
    harm(b, grukk, 99);
    expect(grukk.status).toBe('dying');
    harm(b, grukk, 1);
    expect(grukk.status).toBe('dead');
    const other = who(b, 'foe-0-1');
    other.status = 'asleep';
    other.hp = 10;
    harm(b, other, 1);
    expect(other.status).toBe('active');
  });

  it('gives the covered rear advantage on saves and Broken characters disadvantage', () => {
    const { b } = setup([10, 6]);
    const lirael = who(b, 'Lirael');
    expect(save(b, lirael, 'physical').score).toBe(16);
    b.rng = scriptedRng([10, 6]);
    lirael.strain = { strain: 0, max: 10, broken: true };
    expect(save(b, lirael, 'physical').score).toBe(10);
  });

  it('caps Pavis of Elements at AC 18', () => {
    const { snag, thug } = setup([]);
    thug.acBonus = 4;
    expect(effectiveAc(thug)).toBe(17);
    snag.acBonus = 4;
    expect(effectiveAc(snag)).toBe(18);
    snag.ac = 19;
    expect(effectiveAc(snag)).toBe(19);
  });
});
