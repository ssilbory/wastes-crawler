import { describe, expect, it } from 'vitest';
import { attackOdds, blastOdds, oddsText } from '../../src/render/fight-odds.ts';
import { castMagic } from '../../src/game/combat/spells.ts';
import { scriptedThen } from '../helpers/scripted-rng.ts';
import { createRng } from '../../src/rules/rng.ts';
import type { Action, Attack } from '../../src/game/combat/types.ts';
import { standardBattle, who } from '../game/combat/helpers.ts';

const attack = (index: number, target = 'foe-0-0', smite = false): Action =>
  smite
    ? { kind: 'attack', attack: index, target, smite: true }
    : { kind: 'attack', attack: index, target };

describe('fight odds (docs/presentation-plan.md, V3)', () => {
  it('reads the chance to hit, a hit’s range, and a miss’s Shock', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    // Light spear +3 against AC 13 needs a 10: 11 faces in 20. A 1d6+3 hit is never under its
    // Shock of 5.
    expect(attackOdds(b, snag, attack(0) as never)).toEqual({
      chance: 0.55,
      min: 5,
      max: 9,
      shock: 5,
    });
    expect(oddsText(b, snag, attack(0))).toBe('55% to hit, 5–9 damage, 5 Shock on a miss');
    // Thrown with a foe in melee: -4, and no Shock.
    expect(oddsText(b, snag, attack(1))).toBe('35% to hit, 4–9 damage');
  });

  it('counts God Wills It, Flame Without End, and Red Harvest’s next hit', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    snag.blessed = 1;
    snag.flame = 2;
    snag.nextHitBonus = 4;
    expect(attackOdds(b, snag, attack(0) as never)).toEqual({
      // The blessing's +1 to hit too.
      chance: 0.8,
      // 1d6 + 3, +1 blessed, +2 flame; God Wills It adds to Shock too, but flame doesn't.
      min: 7,
      max: 12,
      shock: 6,
    });
  });

  it('adds Smite the Wicked to hit and the level to damage', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    const smite = b.data.content.combatMagic.find((m) => m.effect.kind === 'smite-wicked');
    const edge = smite?.effect.kind === 'smite-wicked' ? smite.effect.hit : 0;
    expect(edge).toBeGreaterThan(0);
    // No caster level: only the edge to hit.
    expect(attackOdds(b, snag, attack(0, 'foe-0-0', true) as never)).toMatchObject({
      chance: 0.55 + edge / 20,
      min: 5,
    });
    // Content without the art gives no edge.
    const bare = { ...b, data: { ...b.data, content: { ...b.data.content, combatMagic: [] } } };
    expect(attackOdds(bare, snag, attack(0, 'foe-0-0', true) as never)).toMatchObject({
      chance: 0.55,
    });
    snag.caster = { level: 2 } as never;
    expect(attackOdds(b, snag, attack(0, 'foe-0-0', true) as never)).toMatchObject({
      min: 7,
      max: 11,
    });
  });

  it('lands every blow on the doomed for the most its dice can do', () => {
    const b = standardBattle([['thug-or-militia']]);
    who(b, 'foe-0-0').doomedUntil = b.round;
    expect(oddsText(b, who(b, 'Snag'), attack(0))).toBe('100% to hit, 9 damage, 5 Shock on a miss');
  });

  it('shows no Shock a target is immune to, and never a range below 0', () => {
    const b = standardBattle([['thug-or-militia']]);
    const thug = who(b, 'foe-0-0');
    thug.totalDefense = true;
    const fizz = who(b, 'Fizzwick');
    fizz.attacks[0] = { ...(fizz.attacks[0] as Attack), damageBonus: -5 };
    expect(attackOdds(b, fizz, attack(0) as never)).toMatchObject({ min: 0, max: 1, shock: 0 });
  });

  it('has nothing for an action that isn’t an attack, or a target that is gone', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    expect(oddsText(b, snag, { kind: 'total-defense' })).toBeNull();
    expect(oddsText(b, snag, attack(0, 'nobody'))).toBeNull();
    expect(oddsText(b, snag, attack(9))).toBeNull();
  });
});

describe('Elemental Blast odds and blows (1.5.7)', () => {
  function blaster() {
    const b = standardBattle([['thug-or-militia']]);
    const mage = who(b, 'Fizzwick');
    (mage.caster as NonNullable<typeof mage.caster>).arts.push('elemental-blast');
    // In the front row, clear of the rear's cover.
    [mage.row, mage.column] = [0, 2];
    return { b, mage };
  }
  const blast = { kind: 'cast', magic: 'elemental-blast', target: 'foe-0-0' } as const;

  it('reads its own roll: level, best attribute, and skill to hit; dice, level, and attribute to harm', () => {
    const { b, mage } = blaster();
    const e = b.data.content.combatMagic.find((m) => m.id === 'elemental-blast')?.effect;
    if (e?.kind !== 'blast') throw new Error('no blast');
    const attr = Math.max(...e.attributes.map((a) => mage.modifiers[a]));
    const level = mage.caster?.level ?? 0;
    const skill = mage.skills[e.skill] ?? -2;
    const need = 13 - level - attr - skill;
    expect(blastOdds(b, mage, blast)).toEqual({
      chance: Math.min(20, Math.max(0, 21 - Math.max(1, need))) / 20,
      min: e.damage.count + e.damage.modifier + level + attr,
      max: e.damage.count * e.damage.sides + e.damage.modifier + level + attr,
      shock: 0,
    });
    expect(oddsText(b, mage, blast)).toMatch(/^\d+% to hit, \d+–\d+ damage$/);
  });

  it('has none for other magic, a gone target, or someone who can’t cast', () => {
    const { b, mage } = blaster();
    expect(
      oddsText(b, mage, { kind: 'cast', magic: 'the-coruscating-coffin', target: 'foe-0-0' }),
    ).toBeNull();
    expect(oddsText(b, mage, { ...blast, target: 'nobody' })).toBeNull();
    expect(blastOdds(b, { ...mage, caster: null }, blast)).toBeNull();
  });

  it('floats its hit or its miss like a weapon’s', () => {
    const { b, mage } = blaster();
    b.rng = scriptedThen([1], createRng('blast'));
    castMagic(b, mage, 'elemental-blast', 'foe-0-0', undefined);
    expect(b.events?.at(-1)).toMatchObject({ kind: 'miss', actor: mage.id, target: 'foe-0-0' });
    b.rng = scriptedThen([20], createRng('blast'));
    mage.caster = { ...(mage.caster as NonNullable<typeof mage.caster>), usedThisScene: new Set() };
    castMagic(b, mage, 'elemental-blast', 'foe-0-0', undefined);
    expect(b.events?.at(-1)).toMatchObject({ kind: 'hit', target: 'foe-0-0' });
  });
});
