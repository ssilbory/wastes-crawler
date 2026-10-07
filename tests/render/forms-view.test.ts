import { describe, expect, it } from 'vitest';
import { formsView, formText } from '../../src/render/forms-view.ts';
import { data, member, world } from '../game/world/helpers.ts';
import { shifter, WAR, WOLF } from '../game/shifter.ts';

describe('the forms panel and sheet', () => {
  it('lists each Skinshifter’s worn form and the others to take', () => {
    const w = world();
    expect(formsView(w)).toEqual([]);
    const m = member(w, 'Snag');
    m.character = { ...shifter(), id: m.character.id };
    expect(formsView(w)).toEqual([
      {
        id: m.id,
        name: 'Snag',
        worn: null,
        forms: [
          { index: 0, name: 'Wolf' },
          { index: 1, name: 'War Shape' },
        ],
      },
    ]);
    m.form = 1;
    expect(formsView(w)[0]).toMatchObject({
      worn: 'War Shape',
      forms: [{ index: 0, name: 'Wolf' }],
    });
    m.form = 5;
    expect(formsView(w)[0]?.worn).toBeNull();
  });

  it('describes a form by its shape and arts', () => {
    expect(formText(data, WOLF)).toBe(
      'Wolf: Savage Talons, Intrinsic Armor, Feral Prowess (Dexterity)',
    );
    expect(formText(data, WAR)).toBe('War Shape: humanoid, Sculptor’s Beauty, Warform');
    expect(formText(data, { name: 'Blob', humanoid: false, arts: [] })).toBe('Blob');
    expect(formText(data, { name: 'Odd', humanoid: false, arts: ['nope'] })).toBe('Odd: nope');
  });
});
