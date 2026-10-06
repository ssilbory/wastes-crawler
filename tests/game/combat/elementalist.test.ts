import { describe, expect, it } from 'vitest';
import { act } from '../../../src/game/combat/actions.ts';
import { monsterAction, partyAction } from '../../../src/game/combat/ai.ts';
import { resolveAttack } from '../../../src/game/combat/attack.ts';
import { commandsFor } from '../../../src/game/combat/commands.ts';
import { roundPasses } from '../../../src/game/combat/conditions.ts';
import { effectiveAc, harm } from '../../../src/game/combat/damage.ts';
import { castMagic } from '../../../src/game/combat/spells.ts';
import { targets } from '../../../src/game/combat/targeting.ts';
import type { Attack, Battle, CasterState, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng, scriptedThen } from '../../helpers/scripted-rng.ts';
import { standardBattle, who } from './helpers.ts';

/** Fizzwick as an Elementalist of `level` with these spells prepared and no arts. */
function elementalist(b: Battle, spells: string[], level: number): Combatant {
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

/** Every foe given plenty of hit points. */
function sturdy(b: Battle, hp = 40): Combatant[] {
  const foes = b.combatants.filter((c) => c.side === 'enemy');
  for (const c of foes) Object.assign(c, { hp, maxHp: hp });
  return foes;
}

const log = (b: Battle) => (b.log ?? []).join('\n');
const swing = (c: Combatant) => c.attacks[0] as Attack;

describe('Elementalist spells in combat (Phase 18b, 4.5.0)', () => {
  it('Hail of Stones: 1d6 per two levels on a row, an Evasion save halves it', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia'], ['thug-or-militia']]);
    const [a, c, rear] = sturdy(b) as [Combatant, Combatant, Combatant];
    const f = elementalist(b, ['hail-of-stones'], 5);
    b.rng = scriptedRng([4, 5, 1, 20]);
    cast(b, f, 'hail-of-stones', { row: 0 });
    expect([a.hp, c.hp, rear.hp]).toEqual([31, 36, 40]);
    // At first level it still throws 1d6.
    (f.caster as CasterState).level = 1;
    b.rng = scriptedRng([6, 1, 1]);
    cast(b, f, 'hail-of-stones', { row: 0 });
    expect([a.hp, c.hp]).toEqual([25, 30]);
  });

  it('Ward of the Turning Wind: +4 AC on an ally, never above 18, not on top of Pavis', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = elementalist(b, ['ward-of-the-turning-wind'], 1);
    const snag = who(b, 'Snag');
    snag.ac = 13;
    cast(b, f, 'ward-of-the-turning-wind', { target: snag.id });
    expect([snag.acBonus, effectiveAc(snag)]).toEqual([4, 17]);
    snag.ac = 16;
    expect(effectiveAc(snag)).toBe(18);
    // With no one named, the ward wraps the caster.
    cast(b, f, 'ward-of-the-turning-wind');
    expect(f.acBonus).toBe(4);
    // A greater bonus already held stays as it is.
    f.acBonus = 6;
    cast(b, f, 'ward-of-the-turning-wind', { target: f.id });
    expect(f.acBonus).toBe(6);
  });

  it('Boreal Wings: an ally flies for the scene', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = elementalist(b, ['boreal-wings'], 3);
    cast(b, f, 'boreal-wings', { target: who(b, 'Snag').id });
    expect(who(b, 'Snag').flyingRounds).toBe(100);
  });

  it('Flame Without End: +2 damage on a hit, nothing to Shock', () => {
    const b = standardBattle([['thug-or-militia']]);
    const [thug] = sturdy(b) as [Combatant];
    const f = elementalist(b, ['flame-without-end'], 3);
    cast(b, f, 'flame-without-end', { target: thug.id });
    expect(thug.flame).toBe(2);
    const snag = who(b, 'Snag');
    Object.assign(snag, { hp: 50, maxHp: 50, veteransLuck: false });
    b.rng = scriptedRng([20, 3]);
    resolveAttack(b, thug, swing(thug), snag);
    expect(snag.hp).toBe(45);
    expect(cast(b, f, 'flame-without-end')).toBe(true);
  });

  it('Elemental Vallation: each foe burns once crossing to strike in melee', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
    const [a, c] = sturdy(b) as [Combatant, Combatant];
    const f = elementalist(b, ['elemental-vallation'], 3);
    cast(b, f, 'elemental-vallation');
    expect(b.walls).toEqual([
      { side: 'enemy', damage: { count: 3, sides: 6, modifier: 0 }, bonus: 3, crossed: [] },
    ]);
    const snag = who(b, 'Snag');
    Object.assign(snag, { hp: 99, maxHp: 99, veteransLuck: false });
    b.rng = scriptedThen([6, 6, 6], createRng('wall'));
    resolveAttack(b, a, swing(a), snag);
    expect(a.hp).toBe(19);
    expect(log(b)).toContain('crosses the wall of fire');
    resolveAttack(b, a, swing(a), snag);
    expect(a.hp).toBe(19);
    // A ranged swing doesn't cross, and a foe the fire drops never strikes.
    resolveAttack(b, c, { ...swing(c), mode: 'ranged' }, snag);
    expect(c.hp).toBe(40);
    c.hp = 5;
    const hp = snag.hp;
    b.rng = scriptedRng([6, 6, 6]);
    resolveAttack(b, c, swing(c), snag);
    expect([c.status, snag.hp]).toEqual(['dead', hp]);
    // The wall burns only the walled side's foes, and a wall raised by a foe faces the party.
    b.rng = createRng('ours');
    resolveAttack(b, snag, swing(snag), a);
    expect(b.walls[0]?.crossed).toEqual([a.id, c.id]);
    f.side = 'enemy';
    cast(b, f, 'elemental-vallation');
    expect(b.walls[1]?.side).toBe('party');
  });

  it('Like the Stones: three points off every harm, and stable at zero', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = elementalist(b, ['like-the-stones'], 5);
    cast(b, f, 'like-the-stones');
    expect(f).toMatchObject({ stone: 3, poisonImmune: true });
    const hp = f.hp;
    harm(b, f, 2);
    expect(f.hp).toBe(hp);
    expect(log(b)).toContain("The blow glances off Fizzwick's stony flesh.");
    harm(b, f, 5);
    expect(f.hp).toBe(hp - 2);
    harm(b, f, 99);
    expect(f.status).toBe('stable');
  });

  it('Wind Walking: weapons pass through the mist, which can only take form again', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
    const [thug, other] = b.combatants.filter((c) => c.side === 'enemy') as [Combatant, Combatant];
    const f = elementalist(b, ['wind-walking'], 5);
    const snag = who(b, 'Snag');
    cast(b, f, 'wind-walking', { target: snag.id });
    expect(snag.misted).toBe(true);
    expect(targets(b, thug, swing(thug))).not.toContain(snag);
    expect(targets(b, snag, swing(snag))).toEqual([]);
    expect(commandsFor(b, snag).map((c) => c.key)).toEqual(['end-mist']);
    // Badly hurt, an auto-played ally stays in the mist; hale, it takes form.
    snag.hp = 1;
    expect(partyAction(b, snag)).toEqual({ kind: 'wait' });
    snag.hp = snag.maxHp;
    expect(partyAction(b, snag)).toEqual({ kind: 'end-mist' });
    act(b, snag, { kind: 'end-mist' });
    expect(snag.misted).toBe(false);
    // On a foe, it costs them their turn to take form again.
    cast(b, f, 'wind-walking', { target: other.id });
    expect(monsterAction(b, other)).toEqual({ kind: 'end-mist' });
    expect(cast(b, f, 'wind-walking')).toBe(true);
  });

  it('Calcifying Scourge: stone on a failed save, slowed on a success', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
    const [a, c] = sturdy(b) as [Combatant, Combatant];
    const f = elementalist(b, ['calcifying-scourge'], 7);
    b.rng = scriptedRng([1]);
    cast(b, f, 'calcifying-scourge', { target: a.id });
    expect([a.status, a.spellbound]).toEqual(['out', true]);
    b.rng = scriptedRng([20, 4]);
    cast(b, f, 'calcifying-scourge', { target: c.id });
    expect([c.status, c.rootedRounds]).toEqual(['active', 4]);
    expect(cast(b, f, 'calcifying-scourge')).toBe(true);
  });

  it('Elemental Guardian: one earth guardian of 6 HD, once a scene', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = elementalist(b, ['elemental-guardian'], 7);
    cast(b, f, 'elemental-guardian');
    const guardian = b.combatants.at(-1) as Combatant;
    expect(guardian).toMatchObject({ name: 'Elemental Guardian', hitDice: 6, side: 'party' });
    expect(cast(b, f, 'elemental-guardian')).toBe(false);
    (f.caster as CasterState).usedThisScene.clear();
    cast(b, f, 'elemental-guardian');
    expect(log(b)).toContain('Fizzwick already has a servant of that kind.');
    expect(b.combatants.filter((c) => c.name === 'Elemental Guardian')).toHaveLength(1);
  });

  it('Fury of the Elements: 10d6 on a row, wandering the foe’s rows until it dies out', () => {
    const b = standardBattle([['thug-or-militia'], ['thug-or-militia']]);
    const [front, rear] = sturdy(b, 100) as [Combatant, Combatant];
    const f = elementalist(b, ['fury-of-the-elements'], 9);
    b.rng = scriptedRng([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2]);
    cast(b, f, 'fury-of-the-elements', { row: 0 });
    expect([front.hp, rear.hp]).toEqual([90, 100]);
    expect(b.fury).toMatchObject({ side: 'enemy', row: 0, roundsLeft: 1 });
    // It drifts to the rear row; a drift past the last row stays on it.
    b.rng = scriptedRng([1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
    roundPasses(b);
    expect([front.hp, rear.hp, b.fury?.row]).toEqual([90, 80, 1]);
    roundPasses(b);
    expect(b.fury).toBeNull();
    expect(log(b)).toContain('The fury of the elements dies out.');
    b.fury = { side: 'enemy', row: 2, damage: { count: 1, sides: 6, modifier: 0 }, roundsLeft: 1 };
    b.rng = scriptedRng([1, 3]);
    roundPasses(b);
    expect(b.fury.row).toBe(2);
    // It can drift back toward the front, too.
    b.fury = { ...b.fury, row: 1, roundsLeft: 1 };
    b.rng = scriptedRng([0, 3]);
    roundPasses(b);
    expect(b.fury?.row).toBe(0);
    // With no row named, it strikes the front row.
    b.rng = createRng('fury');
    expect(cast(b, f, 'fury-of-the-elements')).toBe(true);
    expect(b.fury?.row).toBe(0);
  });
});
