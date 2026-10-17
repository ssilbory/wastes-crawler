import { describe, expect, it } from 'vitest';
import { pcCombatant } from '../../../src/game/combat/combatants.ts';
import { monsterCombatant } from '../../../src/game/combat/monster-combatant.ts';
import {
  attackSteps,
  covered,
  exposed,
  inMelee,
  rangedModifier,
  targets,
  usable,
} from '../../../src/game/combat/targeting.ts';
import type { Attack } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, standardBattle, starter, who } from './helpers.ts';

const rng = () => createRng('combatants');

describe('pcCombatant', () => {
  it('folds Killing Blow, Veteran’s Luck, shields, and Alert into a Warrior', () => {
    const snag = pcCombatant(data, starter('snag'));
    expect(snag).toMatchObject({
      side: 'party',
      kind: 'pc',
      ac: 18,
      veteransLuck: true,
      shield: true,
      initiativeBonus: 1,
    });
    // Spear: hit +3; damage Dex 1 + Armsmaster 1 + Killing Blow 1; Shock 2 + 1 + 1 + 1.
    expect(snag.attacks[0]).toMatchObject({
      name: 'Spear, Light',
      mode: 'melee',
      hit: 3,
      damageBonus: 3,
      shock: { damage: 5, maxAc: 13 },
    });
    expect(snag.attacks.at(-1)).toMatchObject({ name: 'Unarmed Attack', shock: null });
  });

  it('marks two-handed weapons, Deadeye, and casters', () => {
    expect(pcCombatant(data, starter('grukk')).attacks[0]).toMatchObject({
      twoHanded: true,
      reach: false,
    });
    const lirael = pcCombatant(data, starter('lirael'));
    expect(lirael).toMatchObject({ rangedInMelee: -4, caster: null });
    expect(pcCombatant(data, starter('fizzwick')).caster).toMatchObject({
      level: 1,
      effortMax: 2,
      spellsLeft: 1,
      canCast: true,
    });
  });

  it('makes a Poisoner immune to poisons only at level 2 (1.6.0)', () => {
    const base = starter('snag');
    const poisoner = (level: number) =>
      pcCombatant(data, { ...base, foci: [...base.foci, { id: 'poisoner', level }] });
    expect(pcCombatant(data, base).poisonImmune).toBe(false);
    expect(poisoner(1).poisonImmune).toBe(false);
    expect(poisoner(2).poisonImmune).toBe(true);
  });

  it('sets tower shields, melee Shock immunity, acts-first, and the fallen', () => {
    const base = starter('snag');
    const c = pcCombatant(data, {
      ...base,
      hp: { max: 8, current: 0 },
      foci: [...base.foci, { id: 'close-combatant', level: 1 }, { id: 'alert', level: 2 }],
      inventory: [
        { id: 'tower-shield', quantity: 1, location: 'worn' },
        { id: 'healers-pouch', quantity: 1, location: 'stowed' },
      ],
    });
    expect(c).toMatchObject({
      towerShield: true,
      meleeShockImmune: true,
      actsFirst: true,
      hasHealKit: true,
      status: 'dead',
    });
  });
});

describe('monsterCombatant', () => {
  it('uses the assigned SRD weapon for Wpn damage and Shock', () => {
    const thug = monsterCombatant(data, 'thug-or-militia', 'x', rng());
    expect(thug.attacks[0]).toMatchObject({
      name: 'Spear, Light',
      hit: 1,
      damageBonus: 0,
      shock: { damage: 2, maxAc: 13 },
    });
    expect(monsterCombatant(data, 'barbarian-warlord', 'x', rng())).toMatchObject({
      attacksPerRound: 2,
      attacks: [{ shock: { damage: 7, maxAc: null } }],
    });
    expect(monsterCombatant(data, 'elites-or-special-guards', 'x', rng()).attacks[0]?.reach).toBe(
      true,
    );
    expect(monsterCombatant(data, 'peaceful-human', 'x', rng()).attacks[0]?.shock).toBeNull();
  });

  it('uses fixed dice and Shock for beasts, and rolls 1d8 per hit die', () => {
    const wolf = monsterCombatant(data, 'small-pack-predator', 'x', rng());
    expect(wolf.attacks[0]).toMatchObject({
      name: 'Natural attack',
      damage: { count: 1, sides: 4 },
      shock: { damage: 1, maxAc: 13 },
    });
    expect(wolf.hp).toBeGreaterThanOrEqual(1);
    expect(wolf.hp).toBeLessThanOrEqual(8);
    expect(monsterCombatant(data, 'herd-beast', 'x', rng()).attacks[0]?.shock).toBeNull();
    expect(monsterCombatant(data, 'elephantine-grazer', 'x', rng()).attacks[0]?.reach).toBe(true);
    expect(() => monsterCombatant(data, 'dragon', 'x', rng())).toThrow('unknown monster dragon');
  });

  it('handles bows and missing combat data', () => {
    const archers = {
      ...data,
      content: {
        ...data.content,
        monsterCombat: data.content.monsterCombat
          .filter((m) => m.id !== 'peaceful-human')
          .map((m) => (m.id === 'thug-or-militia' ? { ...m, weapon: 'bow-small' } : m)),
      },
    };
    expect(monsterCombatant(archers, 'thug-or-militia', 'x', rng()).attacks[0]).toMatchObject({
      mode: 'ranged',
      shock: null,
      twoHanded: true,
    });
    expect(monsterCombatant(archers, 'peaceful-human', 'x', rng()).attacks[0]).toMatchObject({
      damage: { count: 1, sides: 6 },
      shock: null,
    });
  });
});

describe('targeting (docs/rules-adaptation.md, Formation rules)', () => {
  const b = () =>
    standardBattle([['thug-or-militia', 'thug-or-militia'], ['veteran-soldier'], ['petty-mage']]);
  const melee = (atk: Partial<Attack> = {}): Attack => ({
    id: 'x',
    name: 'X',
    mode: 'melee',
    hit: 0,
    damage: { count: 1, sides: 6, modifier: 0 },
    damageBonus: 0,
    shock: null,
    reach: false,
    twoHanded: false,
    blunt: false,
    onHit: null,
    ...atk,
  });

  it('shields the rear behind a standing front character', () => {
    const battle = b();
    const lirael = who(battle, 'Lirael');
    expect(exposed(battle, lirael)).toBe(false);
    expect(covered(battle, lirael)).toBe(true);
    who(battle, 'Snag').status = 'dying';
    expect(exposed(battle, lirael)).toBe(true);
    expect(covered(battle, lirael)).toBe(false);
    expect(exposed(battle, who(battle, 'Snag'))).toBe(false);
    expect(covered(battle, who(battle, 'foe-1-0'))).toBe(true);
    expect(covered(battle, who(battle, 'foe-0-0'))).toBe(false);
  });

  it('limits melee to the front rows, with reach from the second', () => {
    const battle = b();
    const thug = who(battle, 'foe-0-0');
    expect(targets(battle, thug, melee()).map((t) => t.name)).toEqual(['Snag', 'Grukk']);
    const vet = who(battle, 'foe-1-0');
    expect(usable(battle, vet, melee())).toBe(false);
    expect(usable(battle, vet, melee({ reach: true }))).toBe(true);
    expect(usable(battle, who(battle, 'Lirael'), melee())).toBe(false);
    expect(usable(battle, who(battle, 'foe-2-0'), melee({ mode: 'ranged' }))).toBe(false);
    expect(targets(battle, who(battle, 'Snag'), melee()).map((t) => t.id)).toEqual([
      'foe-0-0',
      'foe-0-1',
    ]);
    // Ranged attacks reach any row.
    expect(targets(battle, who(battle, 'Lirael'), melee({ mode: 'ranged' }))).toHaveLength(4);
  });

  it('lets flyers reach anyone, and targets the downed only as a last resort', () => {
    const battle = b();
    const thug = who(battle, 'foe-0-0');
    thug.tags.add('flying');
    expect(targets(battle, thug, melee())).toHaveLength(4);
    expect(usable(battle, { ...thug, row: 2 }, melee())).toBe(true);
    for (const pc of battle.combatants.filter((c) => c.side === 'party')) pc.status = 'dying';
    thug.tags.delete('flying');
    expect(targets(battle, thug, melee()).map((t) => t.name)).toEqual([
      'Snag',
      'Grukk',
      'Lirael',
      'Fizzwick',
    ]);
    expect(targets(battle, who(battle, 'Snag'), melee())).toHaveLength(2);
  });

  it('applies the -4 for ranged attacks in melee, and Deadeye for two-handed ones', () => {
    const battle = b();
    const snag = who(battle, 'Snag');
    expect(inMelee(battle, snag)).toBe(true);
    expect(inMelee(battle, who(battle, 'Lirael'))).toBe(false);
    expect(rangedModifier(battle, snag, melee({ mode: 'thrown' }))).toBe(-4);
    expect(rangedModifier(battle, snag, melee())).toBe(0);
    const bow = melee({ mode: 'ranged', twoHanded: true });
    expect(usable(battle, snag, bow)).toBe(false);
    snag.rangedInMelee = -4;
    expect(usable(battle, snag, bow)).toBe(true);
    expect(rangedModifier(battle, snag, bow)).toBe(-4);
    snag.rangedInMelee = null;
    expect(rangedModifier(battle, snag, bow)).toBe(0);
    snag.blindRounds = 1;
    expect(usable(battle, snag, melee({ mode: 'thrown' }))).toBe(false);
    // Blind, even a Deadeye can't shoot in melee.
    snag.rangedInMelee = -4;
    expect(usable(battle, snag, bow)).toBe(false);
  });

  it('counts cover, blindness, tower shields, and Broken as disadvantage', () => {
    const battle = b();
    const snag = who(battle, 'Snag');
    const lirael = who(battle, 'Lirael');
    const thug = who(battle, 'foe-0-0');
    const vet = who(battle, 'foe-1-0');
    expect(attackSteps(battle, snag, thug, 'melee')).toBe(0);
    expect(attackSteps(battle, lirael, vet, 'ranged')).toBe(-2);
    snag.blindRounds = 1;
    snag.towerShield = true;
    thug.towerShield = true;
    snag.strain = { strain: 0, max: 10, broken: true };
    expect(attackSteps(battle, snag, thug, 'melee')).toBe(-4);
    thug.tags.add('flying');
    expect(attackSteps(battle, thug, lirael, 'melee')).toBe(-1);
  });
});
