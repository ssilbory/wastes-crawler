import { describe, expect, it } from 'vitest';
import { armorClass, innateArmorClass, UNARMORED_AC } from '../../src/rules/armor-class.ts';
import { carryLoad } from '../../src/rules/encumbrance.ts';

describe('armorClass', () => {
  it('starts from AC 10 and adds Dex', () => {
    expect(armorClass({ armorAc: null, dexModifier: -1 })).toBe(UNARMORED_AC - 1);
    expect(armorClass({ armorAc: 17, dexModifier: 2 })).toBe(19);
  });

  it('averages barding down, treating unbarded as AC 10', () => {
    expect(armorClass({ armorAc: 16, barding: { ac: 13 }, dexModifier: 0 })).toBe(14);
    expect(armorClass({ armorAc: null, barding: { ac: null }, dexModifier: 0 })).toBe(10);
  });

  it('takes the better of an innate AC, then applies the shield', () => {
    expect(armorClass({ armorAc: 12, innateAc: 16, dexModifier: 0 })).toBe(16);
    expect(armorClass({ armorAc: 19, innateAc: 16, dexModifier: 0 })).toBe(19);
    const large = { baseAc: 15, bonus: 2 };
    expect(armorClass({ armorAc: null, shield: large, dexModifier: 1 })).toBe(16);
    expect(armorClass({ armorAc: 14, shield: large, dexModifier: 0 })).toBe(16);
  });

  it('computes Impervious Defense', () => {
    expect(innateArmorClass(15, 1)).toBe(16);
    expect(innateArmorClass(15, 2)).toBe(16);
    expect(innateArmorClass(15, 10)).toBe(20);
  });
});

describe('carryLoad', () => {
  it('limits Readied to half Strength and Stowed to Strength, rounded down', () => {
    expect(carryLoad(5, 11, 11)).toEqual({
      readied: 5,
      stowed: 11,
      readiedLimit: 5,
      stowedLimit: 11,
      excess: 0,
      state: 'ok',
    });
    expect(carryLoad(0, 12, 10, 5).state).toBe('ok');
  });

  it('allows half Strength over as Overloaded, and no more', () => {
    expect(carryLoad(7, 10, 10)).toMatchObject({ excess: 2, state: 'overloaded' });
    expect(carryLoad(5, 15, 10)).toMatchObject({ excess: 5, state: 'overloaded' });
    expect(carryLoad(6, 15, 10)).toMatchObject({ excess: 6, state: 'too-heavy' });
  });
});
