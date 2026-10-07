import { describe, expect, it } from 'vitest';
import type { Character, Form } from '../../src/data/schemas/index.ts';
import { characterSheet } from '../../src/game/character/derived.ts';
import { formArts, formBonus, formProblem, maxForms } from '../../src/game/character/forms.ts';
import { exportCharacter, importCharacter } from '../../src/game/character/io.ts';
import { data, starter } from './combat/helpers.ts';
import { shifter, WAR, WOLF } from './shifter.ts';

const sheet = (c: Character, form: number | null = null) => characterSheet(c, data, form);
const attack = (c: Character, form: number | null, id: string) =>
  sheet(c, form).equipment.attacks.find((a) => a.id === id);

describe('a Skinshifter’s alternate forms (1.5.15)', () => {
  it('raises the chosen modifier with Feral Prowess and Charisma with Sculptor’s Beauty', () => {
    const c = shifter();
    expect(sheet(c).modifiers).toMatchObject({ dex: 1, cha: -1 });
    expect(sheet(c, 0).modifiers).toMatchObject({ dex: 2, cha: -1 });
    expect(sheet(c, 1).modifiers).toMatchObject({ dex: 1, cha: 0 });
  });

  it('grows Savage Talons and Intrinsic Armor in the form that has them', () => {
    const c = shifter();
    expect(attack(c, null, 'savage-talons')).toBeUndefined();
    // Level 3: 1d8 + 1, Shock 2 + 1, each plus Dex +2.
    expect(attack(c, 0, 'savage-talons')).toMatchObject({
      damage: { count: 1, sides: 8, modifier: 1 },
      damageBonus: 2,
      shock: { damage: 5, maxAc: 13 },
    });
    expect(sheet(c).equipment.armorClassInput.innateAc).toBeUndefined();
    // 14 + half of 3, rounded down; Dex +2 on top.
    expect(sheet(c, 0).equipment.armorClassInput.innateAc).toBe(15);
    expect(sheet(c, 0).equipment.armorClass).toBe(17);
  });

  it('adds +2 to melee hits with Warform, and the form bonus as the attack bonus floor', () => {
    const c = shifter();
    const spear = (form: number | null) =>
      sheet(c, form).equipment.attacks.find((a) => a.id === 'spear-light' && a.mode === 'melee');
    expect((spear(1)?.hit ?? 0) - (spear(null)?.hit ?? 0)).toBe(2);
    // A Wildshaper's attack bonus is +0 at 3rd level; the form bonus is +2.
    const w = shifter('elementalist-partial-skinshifter');
    expect([sheet(w).attackBonus, sheet(w, 0).attackBonus, sheet(w, 1).attackBonus]).toEqual([
      0, 2, 2,
    ]);
    // A humanoid form without Warform keeps the class bonus.
    const plain = shifter('elementalist-partial-skinshifter', [
      { ...WAR, arts: ['sculptors-beauty'] },
    ]);
    expect(sheet(plain, 0).attackBonus).toBe(0);
    expect(formBonus(data, w.classes)).toBe(2);
    // With two Skinshifter classes, the higher level counts.
    const both = {
      current: 'partial-warrior-skinshifter',
      levels: { ...w.classes.levels, 'partial-warrior-skinshifter': 5 },
    };
    expect(formBonus(data, both)).toBe(3);
    expect(formBonus(data, starter('snag').classes)).toBe(0);
  });

  it('keeps one form per character level, of arts the Skinshifter holds', () => {
    const c = shifter();
    expect(maxForms(data, c)).toBe(3);
    expect(maxForms(data, starter('snag'))).toBe(0);
    expect(formArts(data, c)).not.toContain('change-form');
    expect(formArts(data, c)).not.toContain('pliant-flesh');
    const problem = (forms: Form[]) => formProblem(data, c, forms);
    expect(problem([WOLF, WAR])).toBeNull();
    expect(problem([WOLF, WAR, { ...WAR, name: 'b' }, { ...WAR, name: 'c' }])).toBe(
      'Snag can keep 3 forms',
    );
    expect(formProblem(data, starter('snag'), [WOLF])).toBe('Snag can keep 0 forms');
    const novice = {
      ...c,
      classes: { ...c.classes, levels: { 'partial-warrior-skinshifter': 1 } },
    };
    expect(formProblem(data, novice, [WOLF, WAR])).toBe('Snag can keep 1 form');
    expect(problem([WOLF, { ...WAR, name: 'wolf' }])).toBe('each form needs its own name');
    const named = 'each form needs a name of 1 to 40 letters';
    expect(problem([{ ...WAR, name: '  ' }])).toBe(named);
    expect(problem([{ ...WAR, name: 'x'.repeat(41) }])).toBe(named);
    expect(problem([{ ...WOLF, arts: [...WOLF.arts, 'warform'] }])).toBe(
      'Wolf: a form takes at most 3 arts',
    );
    expect(problem([{ ...WAR, arts: ['warform', 'warform'] }])).toBe(
      'War Shape: each art can be applied once',
    );
    expect(problem([{ ...WAR, arts: ['serpents-kiss'] }])).toBe(
      "War Shape: Snag can't give a form serpents-kiss",
    );
    expect(problem([{ ...WAR, arts: ['change-form'] }])).toBe(
      "War Shape: Snag can't give a form change-form",
    );
    const feral = 'Feral Prowess needs an attribute, and only Feral Prowess takes one';
    expect(problem([{ ...WOLF, feral: undefined } as unknown as Form])).toBe(`Wolf: ${feral}`);
    expect(problem([{ ...WAR, feral: 'con' }])).toBe(`War Shape: ${feral}`);
  });

  it('saves forms with the character, and refuses forms it can’t keep', () => {
    const c = shifter();
    expect(importCharacter(exportCharacter(c), data)).toEqual({ ok: true, character: c });
    const bad = { ...c, forms: [{ ...WAR, arts: ['serpents-kiss'] }] };
    expect(importCharacter(exportCharacter(bad), data)).toEqual({
      ok: false,
      errors: ["forms: War Shape: Snag can't give a form serpents-kiss"],
    });
  });
});
