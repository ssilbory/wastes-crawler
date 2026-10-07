import { describe, expect, it } from 'vitest';
import { awaitsRescue, concludeBattle, rescues } from '../../../src/game/combat/aftermath.ts';
import { resolveAttack } from '../../../src/game/combat/attack.ts';
import { dispel } from '../../../src/game/combat/conditions.ts';
import { stabilize } from '../../../src/game/combat/actions.ts';
import { commandsFor } from '../../../src/game/combat/commands.ts';
import { fall, harm } from '../../../src/game/combat/damage.ts';
import { endOfRound, runRound } from '../../../src/game/combat/round.ts';
import { castMagic } from '../../../src/game/combat/spells.ts';
import { canAct, targets, usable } from '../../../src/game/combat/targeting.ts';
import type { Attack, Battle, CasterState, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { standardBattle, who } from './helpers.ts';

/** Fizzwick as a caster of `level` with these spells prepared and no arts. */
function mage(b: Battle, spells: string[], level: number): Combatant {
  const f = who(b, 'Fizzwick');
  Object.assign(f.caster as CasterState, {
    level,
    known: spells,
    prepared: spells,
    spellsLeft: 9,
    canCast: true,
    arts: [],
  });
  return f;
}

const cast = (b: Battle, f: Combatant, id: string, where: { target?: string; row?: number } = {}) =>
  castMagic(b, f, id, where.target, where.row);

const swing = (c: Combatant) => c.attacks[0] as Attack;
const log = (b: Battle) => (b.log ?? []).join('\n');

describe('High Magic sheltering spells (Phase 18d, 4.4.0)', () => {
  it('The Long Amber Moment: the frozen dying can’t be harmed, can’t act, and come out stable', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = mage(b, ['the-long-amber-moment'], 1);
    const snag = Object.assign(who(b, 'Snag'), { status: 'dying', fellRound: 1, hp: 0 });
    expect(rescues({ ...b, outcome: 'party' }).map((r) => r.magic)).toContain(
      'the-long-amber-moment',
    );
    cast(b, f, 'the-long-amber-moment', { target: snag.id });
    expect(snag.amber).toBe(true);
    harm(b, snag, 10);
    expect(snag.status).toBe('dying');
    const thug = who(b, 'Thug or Militia');
    expect(targets(b, thug, swing(thug))).not.toContain(snag);
    for (let i = 0; i < 12; i++) endOfRound(b);
    expect(snag.status).toBe('dying');
    b.outcome = 'party';
    concludeBattle(b);
    expect([snag.status, snag.amber]).toEqual(['stable', false]);
    // A frozen ally who isn't dying just thaws.
    const grukk = who(b, 'Grukk');
    grukk.amber = true;
    expect(canAct(grukk)).toBe(false);
    concludeBattle(b);
    expect([grukk.status, grukk.amber]).toEqual(['active', false]);
    expect(cast(b, f, 'the-long-amber-moment')).toBe(true);
  });

  it('Velocitous Imbuement: the first allies by level strike any row in melee, for 1 strain', () => {
    const b = standardBattle([['thug-or-militia'], ['thug-or-militia']]);
    const f = mage(b, ['velocitous-imbuement'], 3);
    const lirael = who(b, 'Lirael');
    const melee: Attack = { ...(lirael.attacks[0] as Attack), mode: 'melee', reach: false };
    expect(usable(b, lirael, melee)).toBe(false);
    const strain = lirael.strain?.strain ?? 0;
    // An ally with no System Strain to bear, such as a hireling, takes none.
    who(b, 'Snag').strain = null;
    cast(b, f, 'velocitous-imbuement');
    expect(['Snag', 'Grukk', 'Lirael', 'Fizzwick'].map((n) => who(b, n).fleet)).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(lirael.strain?.strain).toBe(strain + 1);
    expect(usable(b, lirael, melee)).toBe(true);
    expect(targets(b, lirael, melee)).toHaveLength(2);
  });

  it('The Verdant Vallation: foes hack at the vines until they part; flyers and missiles pass', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = mage(b, ['the-verdant-vallation'], 2);
    cast(b, f, 'the-verdant-vallation');
    expect(b.vines).toEqual({ side: 'enemy', hp: 10 });
    const thug = who(b, 'Thug or Militia');
    const snag = Object.assign(who(b, 'Snag'), { hp: 50, maxHp: 50 });
    b.rng = scriptedRng([4]);
    resolveAttack(b, thug, swing(thug), snag);
    expect([b.vines?.hp, snag.hp]).toEqual([10 - 4 - swing(thug).damageBonus, 50]);
    expect(log(b)).toContain('hacks at the wall of vines');
    b.rng = scriptedRng([6]);
    resolveAttack(b, thug, swing(thug), snag);
    expect(b.vines).toBeNull();
    expect(log(b)).toContain('cuts through the wall of vines');
    // With the vines up again, a flyer goes over them.
    b.vines = { side: 'enemy', hp: 10 };
    thug.flyingRounds = 5;
    b.rng = createRng('over');
    resolveAttack(b, thug, swing(thug), snag);
    expect(b.vines.hp).toBe(10);
    // Cast by a foe, the vines stand before the foe's side.
    f.side = 'enemy';
    cast(b, f, 'the-verdant-vallation');
    expect(b.vines).toEqual({ side: 'party', hp: 10 });
  });

  it('Conjunct the Vital Viscera: hit points flow from the ally with the most to spare', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = mage(b, ['conjunct-the-vital-viscera'], 5);
    const [snag, grukk, lirael] = ['Snag', 'Grukk', 'Lirael'].map((n) => who(b, n)) as [
      Combatant,
      Combatant,
      Combatant,
    ];
    Object.assign(snag, { status: 'dying', hp: 0, maxHp: 20 });
    Object.assign(grukk, { hp: 30, maxHp: 30 });
    Object.assign(lirael, { hp: 10, maxHp: 20 });
    Object.assign(f, { hp: 5, maxHp: 10 });
    cast(b, f, 'conjunct-the-vital-viscera', { target: snag.id });
    expect([snag.status, snag.hp, grukk.hp]).toEqual(['active', 15, 15]);
    // A stable ally is revived too.
    Object.assign(lirael, { status: 'stable', hp: 0 });
    grukk.hp = 30;
    cast(b, f, 'conjunct-the-vital-viscera', { target: lirael.id });
    expect([lirael.status, lirael.hp]).toEqual(['active', 15]);
    // A hurt ally still standing just gains what it needs.
    cast(b, f, 'conjunct-the-vital-viscera', { target: snag.id });
    expect([snag.status, snag.hp]).toEqual(['active', 20]);
    // With no one able to act above half, it can't be cast, nor offered to save the dying.
    lirael.hp = 10;
    grukk.hp = 15;
    Object.assign(snag, { status: 'dying', hp: 0 });
    expect(cast(b, f, 'conjunct-the-vital-viscera', { target: snag.id })).toBe(false);
    expect(rescues({ ...b, outcome: 'party' })).toEqual([]);
    // A frozen ally gives nothing.
    Object.assign(grukk, { hp: 30, amber: true });
    expect(cast(b, f, 'conjunct-the-vital-viscera', { target: snag.id })).toBe(false);
    expect(cast(b, f, 'conjunct-the-vital-viscera')).toBe(true);
  });

  it('The Invincible Citadel: cast as a PC would fall, and the party escapes the fight', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = mage(b, ['invocation-of-the-invincible-citadel'], 9);
    const snag = Object.assign(who(b, 'Snag'), { hp: 3 });
    const lirael = Object.assign(who(b, 'Lirael'), { status: 'dying', fellRound: b.round });
    // Monsters and a caster with nothing left don't raise it.
    const thug = who(b, 'Thug or Militia');
    harm(b, thug, 99);
    expect(b.escaped).toBe(false);
    (f.caster as CasterState).spellsLeft = 0;
    harm(b, who(b, 'Grukk'), 99);
    expect([who(b, 'Grukk').status, b.escaped]).toEqual(['dying', false]);
    (f.caster as CasterState).spellsLeft = 1;
    thug.status = 'active';
    // Each turn lands a killing blow on Snag; the citadel turns it, and the fight ends.
    const blow = (battle: Battle) => {
      harm(battle, snag, 99);
      return { kind: 'wait' } as const;
    };
    runRound(b, blow, blow);
    expect([snag.status, snag.hp, b.escaped, b.outcome]).toEqual(['active', 1, true, 'draw']);
    expect((f.caster as CasterState).spellsLeft).toBe(0);
    expect(log(b)).toContain('raises the Invincible Citadel');
    // Once raised it holds: nothing more reaches the party, the dying included.
    harm(b, snag, 99);
    harm(b, lirael, 5);
    expect([snag.hp, lirael.status]).toEqual([1, 'dying']);
    expect(awaitsRescue(b)).toBe(false);
    b.rng = createRng('tend');
    concludeBattle(b);
    expect(lirael.status).not.toBe('dying');
  });

  it('The Invincible Citadel costs an Invoker 5 points (1.5.11)', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = mage(b, ['invocation-of-the-invincible-citadel'], 9);
    Object.assign(f.caster as CasterState, { spellsLeft: 0, pointsLeft: 5 });
    harm(b, who(b, 'Snag'), 99);
    expect([b.escaped, (f.caster as CasterState).pointsLeft]).toEqual([true, 0]);
  });

  it('The Invincible Citadel spares the Frail, and once up costs nothing more', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = mage(b, ['invocation-of-the-invincible-citadel'], 9);
    // A second blow in the same breath finds the bubble already up, and costs nothing.
    const [snag, grukk] = [who(b, 'Snag'), who(b, 'Grukk')];
    const before = grukk.hp;
    Object.assign(snag, { hp: 2, frail: true });
    harm(b, snag, 10);
    harm(b, grukk, 999);
    expect([snag.status, snag.hp, grukk.hp]).toEqual(['active', 1, before]);
    expect((f.caster as CasterState).spellsLeft).toBe(8);
    // A fall from outside a blow, such as a lapsing spell, finds it up as well.
    Object.assign(grukk, { hp: 0 });
    fall(b, grukk);
    expect([grukk.status, grukk.hp]).toEqual(['active', 1]);
  });

  it('Final Death: foes in a row, one a level, can’t be healed and die where others would fall', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia', 'thug-or-militia']]);
    const f = mage(b, ['final-death'], 2);
    cast(b, f, 'final-death', { row: 0 });
    const thugs = b.combatants.filter((c) => c.side === 'enemy');
    expect(thugs.map((t) => t.finalDeath)).toEqual([true, true, false]);
    // A cursed PC dies at zero instead of lying Mortally Wounded.
    const snag = Object.assign(who(b, 'Snag'), { finalDeath: true });
    harm(b, snag, 999);
    expect(snag.status).toBe('dead');
    // Healing fails on the cursed, who then save to throw it off.
    const grukk = Object.assign(who(b, 'Grukk'), { finalDeath: true, hp: 1 });
    const heal = mage(b, ['conjunct-the-vital-viscera'], 5);
    Object.assign(who(b, 'Lirael'), { hp: 40, maxHp: 40 });
    b.rng = scriptedRng([2]);
    cast(b, heal, 'conjunct-the-vital-viscera', { target: grukk.id });
    expect([grukk.hp, grukk.finalDeath]).toEqual([1, true]);
    b.rng = scriptedRng([20]);
    cast(b, heal, 'conjunct-the-vital-viscera', { target: grukk.id });
    expect([grukk.hp, grukk.finalDeath]).toEqual([1, false]);
    expect(log(b)).toContain('throws off the curse');
    // Healing arts fail on the cursed as well.
    grukk.finalDeath = true;
    Object.assign(heal.caster as CasterState, {
      arts: ['healing-touch'],
      effortMax: 3,
      effortUsed: 0,
    });
    b.rng = createRng('touch');
    cast(b, heal, 'healing-touch', { target: grukk.id });
    expect(grukk.hp).toBe(1);
  });

  it('Extirpate Arcana ends amber, fleet feet, and Final Death; the frozen dying come out stable', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = Object.assign(who(b, 'Snag'), { amber: true, fleet: true, finalDeath: true });
    const grukk = Object.assign(who(b, 'Grukk'), { amber: true, status: 'dying', fellRound: 1 });
    dispel(b, snag);
    expect([snag.amber, snag.fleet, snag.finalDeath]).toEqual([false, false, false]);
    expect([grukk.status, grukk.frail, grukk.amber]).toEqual(['stable', true, false]);
  });

  it('keeps the frozen out of Merge Souls, stabilizing, and their own casting', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = mage(b, ['the-long-amber-moment'], 1);
    const [snag, grukk] = [who(b, 'Snag'), who(b, 'Grukk')];
    Object.assign(snag, { hp: 10, maxHp: 10, mergedWith: grukk.id });
    Object.assign(grukk, { hp: 10, maxHp: 10, mergedWith: snag.id, amber: true });
    harm(b, snag, 4);
    expect([snag.hp, grukk.hp]).toEqual([6, 10]);
    // No one tends a frozen dying ally.
    Object.assign(grukk, { status: 'dying', fellRound: 1 });
    stabilize(b, snag, grukk);
    expect(b.stabilizedThisRound.has(grukk.id)).toBe(false);
    expect(commandsFor(b, snag).some((c) => c.key === 'stabilize')).toBe(false);
    // The caster can't freeze themself.
    f.hp = 1;
    expect(cast(b, f, 'the-long-amber-moment', { target: f.id })).toBe(false);
  });

  it('The Verdant Vallation lets the mad strike their own side', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
    const [a, c] = b.combatants.filter((x) => x.side === 'enemy') as [Combatant, Combatant];
    Object.assign(c, { hp: 50, maxHp: 50, ac: 1 });
    b.vines = { side: 'enemy', hp: 10 };
    b.rng = createRng('mad');
    resolveAttack(b, a, swing(a), c);
    expect(b.vines.hp).toBe(10);
  });
});
