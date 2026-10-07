import { describe, expect, it } from 'vitest';
import { attackText, signed } from '../../src/render/attack-view.ts';

const line = {
  id: 'spear-light',
  name: 'Spear, Light',
  mode: 'melee' as const,
  hit: 2,
  damage: { count: 1, sides: 6, modifier: 0 },
  damageBonus: 1,
  shock: { damage: 2, maxAc: 15 },
};

describe('an attack on the sheet', () => {
  it('gives the hit, damage, and Shock', () => {
    expect(attackText(line)).toBe('Spear, Light (melee) +2, 1d6+1, Shock 2/AC 15');
    expect(attackText({ ...line, shock: { damage: 3, maxAc: null } })).toBe(
      'Spear, Light (melee) +2, 1d6+1, Shock 3/any AC',
    );
    expect(attackText({ ...line, mode: 'thrown', hit: -1, damageBonus: 0, shock: null })).toBe(
      'Spear, Light (thrown) -1, 1d6',
    );
    expect(attackText({ ...line, damageBonus: -2 })).toContain('1d6-2');
    expect([signed(0), signed(3), signed(-1)]).toEqual(['+0', '+3', '-1']);
  });
});
