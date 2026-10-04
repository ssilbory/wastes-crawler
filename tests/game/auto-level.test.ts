import { describe, expect, it } from 'vitest';
import { autoLevel } from '../../src/game/character/auto-level.ts';
import { characterSheet } from '../../src/game/character/derived.ts';
import { createRng } from '../../src/rules/rng.ts';
import { data, starter } from './combat/helpers.ts';

describe('levelling without a player (Phase 12f)', () => {
  it('takes each level with the first fitting foci, and trains the best combat skill', () => {
    const snag = starter('snag');
    const up = autoLevel(data, snag, 5, createRng('snag'));
    expect(characterSheet(up, data).level).toBe(5);
    expect(up.hp.current).toBe(up.hp.max);
    expect(up.hp.max).toBeGreaterThan(snag.hp.max);
    const levels = (c: typeof snag) => c.foci.reduce((n, f) => n + f.level, 0);
    // Alert and Armsmaster each reach level 2.
    expect(levels(up)).toBe(levels(snag) + 2);
    expect(up.skills.stab).toBeGreaterThan(snag.skills.stab ?? -1);
    // The same seed levels the same way.
    expect(autoLevel(data, snag, 5, createRng('snag'))).toEqual(up);
  });

  it('learns arts and spells for a mage, and leaves a character at its level alone', () => {
    const fizz = starter('fizzwick');
    const up = autoLevel(data, fizz, 3, createRng('fizz'));
    expect(up.spells.known.length).toBeGreaterThan(fizz.spells.known.length);
    expect(up.arts.length).toBeGreaterThan(fizz.arts.length);
    const same = autoLevel(data, fizz, 1, createRng('fizz'));
    expect(same.classes).toEqual(fizz.classes);
  });

  it('fails loudly when no focus fits a pick', () => {
    const none = { ...data, content: { ...data.content, focusRules: [] } };
    // A Warrior's second level brings a focus pick.
    expect(() => autoLevel(none, starter('grukk'), 2, createRng('g'))).toThrow(
      "Grukk can't level up automatically",
    );
  });

  it('trains a shooter in Shoot, and names an attribute for Developed Attribute', () => {
    const lirael = autoLevel(data, starter('lirael'), 4, createRng('l'));
    expect(lirael.skills.shoot).toBeGreaterThan(starter('lirael').skills.shoot ?? -1);
    const first = data.content.focusRules.find((f) => f.id === 'developed-attribute');
    if (!first) throw new Error('no Developed Attribute');
    const devFirst = {
      ...data,
      content: {
        ...data.content,
        focusRules: [first, ...data.content.focusRules.filter((f) => f !== first)],
      },
    };
    const grukk = autoLevel(devFirst, starter('grukk'), 2, createRng('g'));
    expect(grukk.foci).toContainEqual({ id: 'developed-attribute', level: 1, attribute: 'con' });
  });
});
