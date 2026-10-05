import { describe, expect, it } from 'vitest';
import { attackRoll, hitDamage, shockDamage, type ShockContext } from '../../src/rules/attacks.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

const open: ShockContext = { targetAc: 13, shieldNegates: false, immune: false };

describe('attackRoll', () => {
  const base = { attackBonus: 1, attributeModifier: 1, skill: 0, targetAc: 15 };

  it('hits on a total equal to or above the AC', () => {
    expect(attackRoll(scriptedRng([13]), base)).toMatchObject({ score: 15, hit: true });
    expect(attackRoll(scriptedRng([12]), base)).toMatchObject({ score: 14, hit: false });
  });

  it('has no automatic hit on a natural 20 or miss on a natural 1', () => {
    expect(attackRoll(scriptedRng([20]), { ...base, targetAc: 30 }).hit).toBe(false);
    expect(attackRoll(scriptedRng([1]), { ...base, targetAc: 3 }).hit).toBe(true);
  });

  it('applies the untrained penalty, modifiers, and advantage', () => {
    expect(attackRoll(scriptedRng([10]), { ...base, skill: null }).score).toBe(10);
    expect(attackRoll(scriptedRng([10]), { ...base, modifier: -4 }).score).toBe(8);
    expect(attackRoll(scriptedRng([10, 4]), { ...base, steps: -1 }).score).toBe(8);
  });
});

describe('shockDamage', () => {
  const rating = { damage: 2, maxAc: 15 };

  it('applies to targets at or below the rating AC, with the attribute and Shock bonuses', () => {
    expect(shockDamage(rating, 1, 3, { ...open, targetAc: 15 })).toBe(6);
    expect(shockDamage(rating, 1, 0, { ...open, targetAc: 16 })).toBe(0);
  });

  it('applies "/-" Shock whatever the AC', () => {
    expect(shockDamage({ damage: 5, maxAc: null }, 0, 0, { ...open, targetAc: 22 })).toBe(5);
    // Cold Flesh caps any one Shock at 2; a null cap is no cap.
    expect(shockDamage({ damage: 5, maxAc: null }, 0, 0, { ...open, cap: 2 })).toBe(2);
    expect(shockDamage({ damage: 1, maxAc: null }, 0, 0, { ...open, cap: 2 })).toBe(1);
    expect(shockDamage({ damage: 5, maxAc: null }, 0, 0, { ...open, cap: null })).toBe(5);
  });

  it('is negated by shields and immunity, and by having no rating', () => {
    expect(shockDamage({ damage: 5, maxAc: null }, 0, 0, { ...open, shieldNegates: true })).toBe(0);
    expect(shockDamage(rating, 0, 0, { ...open, immune: true })).toBe(0);
    expect(shockDamage(null, 2, 2, open)).toBe(0);
  });

  it('never goes below zero', () => {
    expect(shockDamage({ damage: 1, maxAc: 13 }, -2, 0, open)).toBe(0);
  });
});

describe('hitDamage', () => {
  const sword = {
    dice: { count: 1, sides: 8, modifier: 0 },
    attributeModifier: 1,
    shock: { damage: 2, maxAc: 13 },
  };

  it('rolls the weapon die plus the attribute modifier and bonuses', () => {
    expect(hitDamage(scriptedRng([6]), { ...sword, bonus: 2 }, open)).toEqual({
      total: 9,
      dice: [6],
    });
  });

  it('never does less than the Shock the attack would have dealt', () => {
    expect(hitDamage(scriptedRng([1]), { ...sword, shockBonus: 3 }, open).total).toBe(6);
    expect(hitDamage(scriptedRng([1]), sword, { ...open, targetAc: 18 }).total).toBe(2);
  });

  it('loses the Shock floor to a shield or immunity', () => {
    const low = { ...sword, shockBonus: 3 };
    expect(hitDamage(scriptedRng([1]), low, { ...open, shieldNegates: true }).total).toBe(2);
    expect(hitDamage(scriptedRng([1]), low, { ...open, immune: true }).total).toBe(2);
  });

  it('never goes below zero', () => {
    expect(
      hitDamage(scriptedRng([1]), { ...sword, attributeModifier: -2, shock: null }, open).total,
    ).toBe(0);
  });
});
