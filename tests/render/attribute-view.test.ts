import { describe, expect, it } from 'vitest';
import { attributeLabel } from '../../src/render/attribute-view.ts';
import { characterSheet } from '../../src/game/character/derived.ts';
import { data, starter } from '../game/combat/helpers.ts';

describe('an attribute as a choice to raise', () => {
  it("shows the character's score and modifier now", () => {
    const c = starter('grukk');
    const { scores, modifiers } = characterSheet(c, data);
    const sign = modifiers.str >= 0 ? '+' : '';
    expect(attributeLabel(data, c, 'str', 'Strength')).toBe(
      `Strength ${scores.str} (${sign}${modifiers.str})`,
    );
  });

  it('shows a boost bought with skill points', () => {
    const c = starter('grukk');
    const before = characterSheet(c, data).scores.wis;
    const boosted = {
      ...c,
      attributes: { ...c.attributes, advancement: { ...c.attributes.advancement, wis: 1 } },
    };
    expect(attributeLabel(data, boosted, 'wis', 'Wisdom')).toMatch(
      new RegExp(`^Wisdom ${before + 1} \\(`),
    );
  });

  it('signs a negative modifier with a minus', () => {
    const c = starter('grukk');
    const low = { ...c, attributes: { ...c.attributes, base: { ...c.attributes.base, cha: 3 } } };
    expect(attributeLabel(data, low, 'cha', 'Charisma')).toMatch(/^Charisma \d+ \(-\d\)$/);
  });
});
