import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/data/schemas/index.ts';
import { characterSheet } from '../../src/game/character/derived.ts';
import { sheetAbilities } from '../../src/render/sheet-abilities.ts';
import { data, starter } from '../game/combat/helpers.ts';
import { shifter, WAR, WOLF } from '../game/shifter.ts';

/** Fizzwick as `classId` of `level` with these arts. */
function caster(classId: string, arts: string[], level = 4): Character {
  const fizz = starter('fizzwick');
  return { ...fizz, classes: { current: classId, levels: { [classId]: level } }, arts };
}

const acOf = (c: Character) => characterSheet(c, data).equipment.armorClass;

const wearing = (c: Character, ...ids: string[]): Character => ({
  ...c,
  inventory: [...c.inventory, ...ids.map((id) => ({ id, location: 'worn' as const, quantity: 1 }))],
});

describe('arts that change AC or attacks on the character sheet', () => {
  it('shows nothing for a character with none', () => {
    expect(sheetAbilities(data, starter('snag'))).toEqual({ armor: [], attacks: [] });
  });

  it('shows each form’s AC and the attacks only that form has (1.5.15)', () => {
    // A third-level Skinshifter out of armor: AC 11; the Wolf has Intrinsic Armor and Dex +2.
    const c = shifter(undefined, [WOLF, WAR]);
    expect(acOf(c)).toBe(11);
    expect(sheetAbilities(data, c)).toEqual({
      armor: ['Wolf form: AC 17'],
      attacks: ['Wolf form: Savage Talons (melee) +2, 1d8+3, Shock 5/AC 13'],
    });
  });

  it('shows Cold Flesh’s natural AC, and forms worn over it (1.5.14)', () => {
    const c = caster('full-necromancer', ['cold-flesh']);
    const ac = acOf(c);
    expect(ac).toBeLessThan(14);
    expect(sheetAbilities(data, c).armor).toEqual([`Cold Flesh: AC ${14 + (ac - 10)}`]);
    // An art the SRD doesn't know keeps its id as a name.
    const arts = data.srd.arts.filter((a) => a.id !== 'cold-flesh');
    expect(sheetAbilities({ ...data, srd: { ...data.srd, arts } }, c).armor).toEqual([
      `cold-flesh: AC ${14 + (ac - 10)}`,
    ]);
  });

  it('shows Armor of God at the caster level, in armor too (1.5.5)', () => {
    const c = caster('blood-priest-partial-warrior', ['armor-of-god']);
    const ac = acOf(c);
    const line = (n: number) => `Armor of God, while its Effort stays committed: AC ${n}`;
    expect(sheetAbilities(data, c).armor).toEqual([line(17 + (ac - 10))]);
    // A Blood Priest's arts work in armor (1.5.5).
    expect(sheetAbilities(data, wearing(c, 'mail-shirt')).armor).toEqual([line(17 + (ac - 10))]);
  });

  it('shows Pavis of Elements’ +4 up to 18, when armor blocks it, and not when it adds nothing (1.5.7)', () => {
    const c = caster('full-elementalist', ['pavis-of-elements']);
    const line = (n: number) => `Pavis of Elements, while its Effort stays committed: AC ${n}`;
    expect(sheetAbilities(data, c).armor).toEqual([line(Math.min(acOf(c) + 4, 18))]);
    const mail = wearing(c, 'mail-shirt');
    expect(sheetAbilities(data, mail).armor).toEqual([
      `${line(Math.min(acOf(mail) + 4, 18))} (armor blocks it)`,
    ]);
    expect(acOf(wearing(c, 'plate-armor', 'large-shield'))).toBeGreaterThanOrEqual(18);
    expect(sheetAbilities(data, wearing(c, 'plate-armor', 'large-shield')).armor).toEqual([]);
    // Cold Flesh at level 10 gives 17, and the Pavis stops at 18. The pairing is only for the test.
    const both = caster('full-elementalist', ['pavis-of-elements', 'cold-flesh'], 10);
    expect(sheetAbilities(data, both).armor).toEqual([
      `Cold Flesh: AC ${17 + (acOf(both) - 10)}`,
      line(18),
    ]);
  });
});
