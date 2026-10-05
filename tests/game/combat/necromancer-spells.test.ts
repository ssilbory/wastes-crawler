import { describe, expect, it } from 'vitest';
import { monsterAction } from '../../../src/game/combat/ai.ts';
import { resolveAttack } from '../../../src/game/combat/attack.ts';
import { dispel, roundPasses } from '../../../src/game/combat/conditions.ts';
import { harm, save } from '../../../src/game/combat/damage.ts';
import { takeTurn } from '../../../src/game/combat/round.ts';
import { castMagic } from '../../../src/game/combat/spells.ts';
import { attackSteps } from '../../../src/game/combat/targeting.ts';
import type { Attack, Battle, CasterState, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng, scriptedThen } from '../../helpers/scripted-rng.ts';
import { standardBattle, who } from './helpers.ts';

/** Fizzwick as a Necromancer of `level` with these spells prepared, Magic-2, and no arts. */
function necromancer(b: Battle, spells: string[], level: number): Combatant {
  const f = who(b, 'Fizzwick');
  Object.assign(f.caster as CasterState, {
    level,
    known: spells,
    prepared: spells,
    spellsLeft: 9,
    canCast: true,
    arts: [],
  });
  f.skills = { ...f.skills, magic: 2 };
  return f;
}

const cast = (b: Battle, f: Combatant, id: string, where: { target?: string; row?: number } = {}) =>
  castMagic(b, f, id, where.target, where.row);

function sturdy(b: Battle, hp = 40): Combatant[] {
  const foes = b.combatants.filter((c) => c.side === 'enemy');
  for (const c of foes) Object.assign(c, { hp, maxHp: hp });
  return foes;
}

const log = (b: Battle) => (b.log ?? []).join('\n');
const swing = (c: Combatant) => c.attacks[0] as Attack;

/** Snag with a fixed pool of hit points and no luck to spare. */
function sturdySnag(b: Battle, hp = 20): Combatant {
  const snag = who(b, 'Snag');
  Object.assign(snag, { hp, maxHp: hp, veteransLuck: false });
  return snag;
}

describe('Necromancer spells in combat (Phase 18c, 4.6.0)', () => {
  it('Augment Mortal Vitality: Magic on Physical saves, stabilizing, one closed wound', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = necromancer(b, ['augment-mortal-vitality'], 3);
    const snag = sturdySnag(b);
    const strain = (snag.strain as NonNullable<Combatant['strain']>).strain;
    cast(b, f, 'augment-mortal-vitality', { target: snag.id });
    expect(snag.vitality).toEqual({ saveBonus: 2, healReady: true });
    expect(snag.strain?.strain).toBe(strain + 1);
    b.rng = scriptedRng([10]);
    expect(save(b, snag, 'physical').score).toBe(12);
    // A scratch stays; the first wound of a quarter of the hit points closes; the next stays.
    harm(b, snag, 2);
    expect(snag.hp).toBe(18);
    harm(b, snag, 6);
    expect(snag.hp).toBe(18);
    expect(log(b)).toContain("Snag's wound closes at once.");
    harm(b, snag, 6);
    expect(snag.hp).toBe(12);
    harm(b, snag, 99);
    expect(snag.status).toBe('stable');
    expect(cast(b, f, 'augment-mortal-vitality')).toBe(true);
    // On one with no System Strain, from a caster without Magic, it adds nothing to the save.
    const thug = who(b, 'foe-0-0');
    delete f.skills.magic;
    cast(b, f, 'augment-mortal-vitality', { target: thug.id });
    expect([thug.vitality?.saveBonus, thug.strain]).toEqual([0, null]);
  });

  it('Enfeebling Wave: the living who fail attack at a disadvantage and keep the worse damage', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia', 'automaton-laborer']]);
    const [a, c, bot] = sturdy(b) as [Combatant, Combatant, Combatant];
    const f = necromancer(b, ['enfeebling-wave'], 3);
    b.rng = scriptedRng([1, 20]);
    cast(b, f, 'enfeebling-wave', { row: 0 });
    expect([a.enfeebledUntil, c.enfeebledUntil, bot.enfeebledUntil]).toEqual([1000, 2, 0]);
    const snag = sturdySnag(b);
    expect(attackSteps(b, a, snag, 'melee')).toBe(attackSteps(b, bot, snag, 'melee') - 1);
    // A natural 20 lands; of the two damage rolls, 6 and 1, the 1 counts.
    b.rng = scriptedRng([20, 1, 6, 1]);
    resolveAttack(b, a, swing(a), snag);
    expect(snag.hp).toBe(19);
  });

  it('Compel Flesh: the held creature tears itself struggling, and strikes its own side', () => {
    const b = standardBattle([
      ['thug-or-militia', 'thug-or-militia', 'automaton-laborer', 'zombie'],
    ]);
    const [a, c, bot, zombie] = sturdy(b) as [Combatant, Combatant, Combatant, Combatant];
    const f = necromancer(b, ['compel-flesh'], 3);
    cast(b, f, 'compel-flesh', { target: a.id });
    cast(b, f, 'compel-flesh', { target: bot.id });
    cast(b, f, 'compel-flesh', { target: zombie.id });
    expect([a.compelled, bot.compelled, zombie.compelled]).toEqual([3, 0, 3]);
    b.rng = scriptedRng([1]);
    expect(monsterAction(b, a)).toMatchObject({ kind: 'attack', attack: 0 });
    // Its turn: the struggle hurts, the save fails, and the blow lands on its own side.
    b.rng = createRng('compel');
    b.queue = [a.id];
    takeTurn(b, a, () => ({ kind: 'attack', attack: 0, target: c.id }));
    expect(a.hp).toBeLessThanOrEqual(37);
    expect(log(b)).toContain("Thug or Militia's flesh writhes against the spell.");
    // With no one in reach, it stands held.
    for (const x of [c, bot, zombie]) x.status = 'dead';
    expect(monsterAction(b, a)).toEqual({ kind: 'wait' });
    // A save throws it off; the rest of the turn rolls as it will.
    b.rng = scriptedThen([20], createRng('free'));
    b.queue = [a.id];
    takeTurn(b, a, () => ({ kind: 'wait' }));
    expect(a.compelled).toBe(0);
    expect(log(b)).toContain('throws off the compulsion');
    expect(cast(b, f, 'compel-flesh')).toBe(true);
  });

  it('Forgetting the Grave: no dying for a round a level, then the fall', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = necromancer(b, ['forgetting-the-grave'], 2);
    const snag = sturdySnag(b);
    cast(b, f, 'forgetting-the-grave', { target: snag.id });
    expect(snag.deathlessUntil).toBe(2);
    harm(b, snag, 99);
    expect([snag.status, snag.hp]).toEqual(['active', 0]);
    // Struck again at zero, a failed save leaves them unable to move.
    b.rng = scriptedRng([1]);
    harm(b, snag, 5);
    expect(snag.rootedRounds).toBeGreaterThan(0);
    b.rng = scriptedRng([20]);
    const grukk = who(b, 'Grukk');
    cast(b, f, 'forgetting-the-grave', { target: grukk.id });
    harm(b, grukk, 99);
    harm(b, grukk, 5);
    expect(grukk.rootedRounds).toBe(0);
    const lirael = who(b, 'Lirael');
    cast(b, f, 'forgetting-the-grave', { target: lirael.id });
    b.round = 3;
    roundPasses(b);
    expect([snag.status, snag.deathlessUntil]).toEqual(['dying', 0]);
    // One still standing when it runs out just goes on.
    expect([lirael.status, lirael.deathlessUntil]).toEqual(['active', 0]);
    expect(cast(b, f, 'forgetting-the-grave')).toBe(true);
  });

  it('Merge Souls: one pool of life, spent together', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = necromancer(b, ['merge-souls'], 5);
    const snag = sturdySnag(b, 10);
    Object.assign(f, { hp: 6, maxHp: 6 });
    cast(b, f, 'merge-souls', { target: snag.id });
    expect([f.mergedWith, snag.mergedWith]).toEqual([snag.id, f.id]);
    harm(b, snag, 12);
    expect([snag.hp, f.hp, snag.status]).toEqual([0, 4, 'active']);
    harm(b, f, 4);
    expect([snag.status, f.status]).toEqual(['dying', 'dying']);
    // With the partner down, harm falls as usual.
    const grukk = who(b, 'Grukk');
    grukk.mergedWith = snag.id;
    const hp = grukk.hp;
    harm(b, grukk, 1);
    expect(grukk.hp).toBe(hp - 1);
    expect(cast(b, f, 'merge-souls')).toBe(true);
    expect(cast(b, f, 'merge-souls', { target: f.id })).toBe(true);
    expect(f.mergedWith).toBe(snag.id);
  });

  it('Call of the Tomb: every blow lands on the doomed, for full damage, through any resistance', () => {
    const b = standardBattle([['swamp-thing', 'thug-or-militia']]);
    const [bog, thug] = sturdy(b) as [Combatant, Combatant];
    const f = necromancer(b, ['call-of-the-tomb'], 4);
    b.rng = scriptedRng([1, 20]);
    cast(b, f, 'call-of-the-tomb');
    expect([bog.doomedUntil, thug.doomedUntil]).toEqual([4, 1]);
    const grukk = who(b, 'Grukk');
    const club: Attack = {
      ...swing(grukk),
      damage: { count: 1, sides: 6, modifier: 0 },
      damageBonus: 0,
    };
    // A natural 1 still lands for the d6's full 6 and more, unhalved by the resistance to blunt.
    b.rng = scriptedRng([1, 1]);
    resolveAttack(b, grukk, club, bog);
    expect(bog.hp).toBeLessThanOrEqual(34);
    expect(log(b)).toContain('Grukk hits Swamp Thing');
  });

  it('Everlasting: cast as an ally would fall, no one drops below 1 HP, then the caster is spent', () => {
    const b = standardBattle([['thug-or-militia']]);
    const f = necromancer(b, ['everlasting'], 9);
    const snag = sturdySnag(b);
    harm(b, snag, 99);
    expect([snag.status, snag.hp]).toEqual(['active', 1]);
    expect(b.everlasting).toEqual({ side: 'party', caster: f.id, until: 5 });
    harm(b, snag, 5);
    expect(snag.hp).toBe(1);
    b.round = 6;
    roundPasses(b);
    expect([b.everlasting, f.hp]).toEqual([null, 1]);
    // Once a fight: the next fall is a fall.
    harm(b, snag, 99);
    expect(snag.status).toBe('dying');
    expect(cast(b, f, 'everlasting')).toBe(true);
    // A caster already down when it runs out stays down.
    const c = standardBattle([['thug-or-militia']]);
    const g = necromancer(c, ['everlasting'], 9);
    harm(c, sturdySnag(c), 99);
    g.status = 'dead';
    c.round = 6;
    roundPasses(c);
    expect(g.hp).not.toBe(1);
  });

  it('end under Extirpate Arcana', () => {
    const b = standardBattle([['thug-or-militia']]);
    const thug = who(b, 'foe-0-0');
    Object.assign(thug, {
      vitality: { saveBonus: 2, healReady: true },
      enfeebledUntil: 9,
      compelled: 3,
      doomedUntil: 9,
    });
    dispel(b, thug);
    expect(thug).toMatchObject({ vitality: null, enfeebledUntil: 0, compelled: 0, doomedUntil: 0 });
  });
});
