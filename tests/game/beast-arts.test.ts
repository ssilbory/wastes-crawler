import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/data/schemas/index.ts';
import { beastShape } from '../../src/game/character/beast-arts.ts';
import { characterSheet } from '../../src/game/character/derived.ts';
import { beastmaster } from './beastmaster.ts';
import { data, starter } from './combat/helpers.ts';

const sheet = (c: Character) => characterSheet(c, data);

describe('the Beastmaster’s sheet arts (1.5.4)', () => {
  it('gives the Ranger and Hunter Survive-based Effort from the better of Wis or Cha', () => {
    // Survive-0, Wis +0 and Cha -1: Effort 0, raised to the minimum of 1.
    expect(sheet(beastmaster()).magic?.effort).toBe(1);
    expect(sheet(beastmaster([], 1, 'beastmaster-partial-expert')).magic?.canCast).toBe(true);
  });

  it('adds Natural Weaponry’s fangs and claws, growing at level 3', () => {
    expect(sheet(beastmaster()).equipment.attacks.some((a) => a.id === 'natural-weaponry')).toBe(
      false,
    );
    const claws = (c: Character) =>
      sheet(c).equipment.attacks.find((a) => a.id === 'natural-weaponry');
    expect(claws(beastmaster(['natural-weaponry'], 2))).toMatchObject({
      damage: { count: 1, sides: 8, modifier: 0 },
      shock: { damage: 3, maxAc: 13 },
    });
    // Level 3: 1d8+1, Shock 2+1, each plus Dex +1.
    expect(claws(beastmaster(['natural-weaponry'], 3))).toMatchObject({
      damage: { count: 1, sides: 8, modifier: 1 },
      damageBonus: 1,
      shock: { damage: 4, maxAc: 13 },
    });
  });

  it('fights with Stab when it is better than Punch', () => {
    const c = beastmaster(['natural-weaponry']);
    const stabber = { ...c, skills: { ...c.skills, stab: 2, punch: 0 } };
    expect(beastShape(stabber).effects[0]).toMatchObject({ weapon: { skill: 'stab' } });
    const puncher = { ...c, skills: { ...c.skills, stab: 0, punch: 1 } };
    expect(beastShape(puncher).effects[0]).toMatchObject({ weapon: { skill: 'punch' } });
  });

  it('sets Feral Toughness’s AC of 13 plus half the level, rounded up, under Dex', () => {
    const tough = beastmaster(['feral-toughness'], 3);
    expect(sheet(tough).equipment.armorClassInput.innateAc).toBe(15);
    // Dex +1.
    expect(sheet(tough).equipment.armorClass).toBe(16);
    expect(sheet(beastmaster()).equipment.armorClassInput.innateAc).toBeUndefined();
  });

  it('lets better armor stand over Feral Toughness', () => {
    const grukk = starter('grukk');
    const tough = { ...grukk, arts: ['feral-toughness'] };
    expect(sheet(tough).equipment.armorClass).toBe(sheet(grukk).equipment.armorClass);
  });
});
