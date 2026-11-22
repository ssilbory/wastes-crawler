import { describe, expect, it } from 'vitest';
import { NO_HARDCORE, type Character, type Hardcore } from '../../../src/data/schemas/index.ts';
import { mendings, rescues, tendDying } from '../../../src/game/combat/aftermath.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import { harm } from '../../../src/game/combat/damage.ts';
import {
  diesAtZero,
  healedEnough,
  healingStrain,
  noteHealed,
} from '../../../src/game/combat/hardcore.ts';
import { canUse, castMagic, combatMagic } from '../../../src/game/combat/spells.ts';
import type { Battle, CasterState, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, standardBattle, starter, who } from './helpers.ts';

// docs/rules-adaptation.md, Hardcore options (Sam's calls).
const on = (o: Partial<Hardcore>): Hardcore => ({ ...NO_HARDCORE, ...o });

/** Snag as a Priest of Death with Healing Touch and Heal-1. */
function priest(): Character {
  const snag = starter('snag');
  return {
    ...snag,
    classes: { current: 'healer-partial-mage', levels: { 'healer-partial-mage': 1 } },
    skills: { ...snag.skills, heal: 1 },
    arts: ['healing-touch', 'facile-healer'],
    spells: { known: [], prepared: [] },
  };
}

function priestBattle(hardcore?: Hardcore): Battle {
  return createBattle({
    data,
    rng: createRng('hardcore'),
    party: [
      { character: priest(), row: 0, column: 0 },
      { character: starter('grukk'), row: 0, column: 1 },
      { character: starter('lirael'), row: 1, column: 0 },
    ],
    enemies: [['thug-or-militia']],
    log: true,
    ...(hardcore ? { hardcore } : {}),
  });
}

/** Grukk at 1 of 30 hit points with no strain. */
function hurt(b: Battle, name = 'Grukk'): Combatant {
  const g = who(b, name);
  Object.assign(g, { hp: 1, maxHp: 30, strain: { strain: 0, max: 10, broken: false } });
  return g;
}

function won(b: Battle): Battle {
  for (const c of b.combatants.filter((x) => x.side === 'enemy')) c.status = 'dead';
  b.outcome = 'party';
  return b;
}

describe('hardcore in a fight', () => {
  it('has every option off unless the world says otherwise', () => {
    expect(standardBattle([['thug-or-militia']]).hardcore).toEqual(NO_HARDCORE);
    expect(priestBattle(on({ deathAtZero: true })).hardcore.deathAtZero).toBe(true);
  });

  it('bars strain casting with No strain casting', () => {
    const b = standardBattle([['skilled-veteran']]);
    const fizz = who(b, 'Fizzwick');
    const caster = fizz.caster as CasterState;
    caster.spellsLeft = 0;
    caster.effortUsed = caster.effortMax;
    const coffin = combatMagic(b, 'the-coruscating-coffin');
    if (!coffin) throw new Error('no coffin');
    expect(canUse(b, fizz, coffin, true)).toBe(true);
    b.hardcore = on({ noStrainCasting: true });
    expect(canUse(b, fizz, coffin, true)).toBe(false);
    expect(castMagic(b, fizz, coffin.id, 'foe-0-0', undefined, true)).toBe(false);
  });

  it('kills a PC at zero with Death at zero, but Die Hard still saves them', () => {
    const b = standardBattle([['thug-or-militia']]);
    b.hardcore = on({ deathAtZero: true });
    const snag = who(b, 'Snag');
    harm(b, snag, snag.hp);
    expect(snag.status).toBe('dead');
    // Grukk has Die Hard (vendor/wwn-srd/1.0 Character Creation/1.6.0 Foci.md).
    const grukk = who(b, 'Grukk');
    harm(b, grukk, grukk.hp);
    expect(grukk).toMatchObject({ status: 'stable', frail: true });
    // Only the party's PCs: foes die at zero anyway.
    expect(diesAtZero(b, who(b, 'foe-0-0'))).toBe(false);
    b.hardcore = NO_HARDCORE;
    expect(diesAtZero(b, who(b, 'Lirael'))).toBe(false);
  });

  it('adds 1 strain to a revival heal with harsh healing', () => {
    const b = priestBattle(on({ harshHealing: true }));
    const grukk = hurt(b);
    expect(healingStrain(b, grukk, 1)).toBe(1);
    expect(healingStrain(b, grukk, 0)).toBe(0);
    Object.assign(grukk, { hp: 0, status: 'dying' });
    expect(healingStrain(b, grukk, 1)).toBe(2);
    b.rng = scriptedRng([2, 2]);
    castMagic(b, who(b, 'Snag'), 'healing-touch', grukk.id, undefined);
    expect(grukk).toMatchObject({ status: 'active', strain: { strain: 2 } });
    // A stabilized ally costs the same; one who can't bear it isn't offered the touch.
    const lirael = hurt(b, 'Lirael');
    Object.assign(lirael, { hp: 0, status: 'stable' });
    expect(healingStrain(b, lirael, 1)).toBe(2);
    lirael.strain = { strain: 9, max: 10, broken: false };
    const touch = combatMagic(b, 'healing-touch');
    if (!touch) throw new Error('no touch');
    b.outcome = 'party';
    expect(canUse(b, who(b, 'Snag'), touch, false, lirael.id)).toBe(false);
    b.hardcore = NO_HARDCORE;
    expect(canUse(b, who(b, 'Snag'), touch, false, lirael.id)).toBe(true);
  });

  it('lets each ally be healed by magic once after the fight with harsh healing', () => {
    const b = won(priestBattle(on({ harshHealing: true })));
    const grukk = hurt(b);
    expect(mendings(b).map((r) => r.target)).toEqual([grukk.id]);
    b.rng = scriptedRng([1, 1]);
    castMagic(b, who(b, 'Snag'), 'healing-touch', grukk.id, undefined);
    expect(grukk.hp).toBeLessThan(grukk.maxHp);
    expect(healedEnough(b, 'touch-heal', grukk.id)).toBe(true);
    expect(mendings(b)).toEqual([]);
    // Potions and other magic aren't counted; nor is a heal with no target.
    expect(healedEnough(b, 'damage', grukk.id)).toBe(false);
    noteHealed(b, 'heal', undefined);
    expect(b.healedAfter.size).toBe(1);
  });

  it('counts nothing during the fight, nor without harsh healing', () => {
    const b = priestBattle(on({ harshHealing: true }));
    const grukk = hurt(b);
    castMagic(b, who(b, 'Snag'), 'healing-touch', grukk.id, undefined);
    expect(b.healedAfter.size).toBe(0);
    expect(healedEnough(b, 'touch-heal', grukk.id)).toBe(false);
    const plain = won(priestBattle());
    const g = hurt(plain);
    castMagic(plain, who(plain, 'Snag'), 'healing-touch', g.id, undefined);
    expect(healedEnough(plain, 'touch-heal', g.id)).toBe(false);
    expect(mendings(plain).map((r) => r.target)).toEqual([g.id]);
  });

  it('leaves a revived ally to Heal checks if the one heal fails to raise them', () => {
    const b = won(priestBattle(on({ harshHealing: true })));
    const grukk = hurt(b);
    Object.assign(grukk, { hp: 0, status: 'dying', fellRound: b.round });
    b.healedAfter.add(grukk.id);
    expect(rescues(b)).toEqual([]);
    tendDying(b, () => null);
    expect(['stable', 'dead']).toContain(grukk.status);
  });
});
