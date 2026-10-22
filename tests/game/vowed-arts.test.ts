import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/data/schemas/index.ts';
import { characterSheet } from '../../src/game/character/derived.ts';
import { vowedShape } from '../../src/game/character/vowed-arts.ts';
import { punchRow, unarmoredAc } from '../../src/rules/vowed.ts';
import { data, starter } from './combat/helpers.ts';
import { vowed } from './vowed.ts';

const sheet = (c: Character) => characterSheet(c, data);
const punchOf = (c: Character) => sheet(c).equipment.attacks.find((a) => a.id === 'unarmed-attack');

describe('the Vowed’s numbers (1.5.17)', () => {
  it('sets Unarmored Defense to 13 plus half the level, rounded down', () => {
    expect([1, 2, 3, 10].map(unarmoredAc)).toEqual([13, 14, 14, 18]);
  });

  it('holds the punch at the table’s first and tenth rows', () => {
    expect([0, 1, 5, 10, 14].map(punchRow)).toEqual([1, 1, 5, 10, 10]);
  });
});

describe('the Vowed’s sheet arts (1.5.17)', () => {
  it('gives the Monk and Ascetic Exert-based Effort and arts', () => {
    expect(sheet(vowed()).magic?.effort).toBeGreaterThanOrEqual(1);
    expect(sheet(vowed(undefined, 1, 'partial-expert-vowed')).magic?.canCast).toBe(true);
  });

  it('swaps the punch for Unarmed Might’s row, adding its hit bonus and Shock', () => {
    const plain = punchOf(vowed([], 10));
    const might = punchOf(vowed(['unarmed-might'], 10));
    expect(might).toMatchObject({
      damage: { count: 1, sides: 10, modifier: 3 },
      hit: (plain?.hit ?? 0) + 5,
    });
    // Shock 4/15 plus Dex +1.
    expect(might?.shock).toEqual({ damage: 5, maxAc: 15 });
    expect(punchOf(vowed(['unarmed-might'], 12))?.damage).toEqual(might?.damage);
  });

  it('drops Unarmed Combatant’s die for the Vowed punch', () => {
    const c = vowed(['unarmed-might'], 1);
    const both = { ...c, foci: [...c.foci, { id: 'unarmed-combatant', level: 1 }] };
    expect(punchOf(both)?.damage).toEqual({ count: 1, sides: 6, modifier: 0 });
    expect(vowedShape(data, both).effects).toHaveLength(1);
  });

  it('loses Unarmed Might in armor and Unarmored Defense under armor or a shield', () => {
    const snag = starter('snag');
    const armored = { ...vowed(), inventory: snag.inventory };
    expect(vowedShape(data, armored)).toEqual({ effects: [], innateAc: null });
    expect(vowedShape(data, vowed())).toMatchObject({ innateAc: 14 });
  });

  it('sets the bare AC from Unarmored Defense, plus Dex', () => {
    expect(sheet(vowed()).equipment.armorClassInput.innateAc).toBe(14);
    expect(sheet(vowed()).equipment.armorClass).toBe(15);
    expect(vowedShape(data, vowed(['unarmed-might'])).innateAc).toBeNull();
  });
});
