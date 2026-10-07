import { describe, expect, it } from 'vitest';
import { formsView } from '../../src/render/forms-view.ts';
import { data, member, world } from '../game/world/helpers.ts';
import { shifter } from '../game/shifter.ts';

describe('the forms panel', () => {
  it('lists each Skinshifter’s worn form and the others to take', () => {
    const w = world();
    expect(formsView(w, data)).toEqual([]);
    const m = member(w, 'Snag');
    m.character = { ...shifter(), id: m.character.id };
    expect(formsView(w, data)).toEqual([
      {
        id: m.id,
        name: 'Snag',
        worn: null,
        forms: [
          { index: 0, name: 'Wolf', hint: expect.stringContaining('Wolf, non-humanoid.') },
          { index: 1, name: 'War Shape', hint: expect.stringContaining('War Shape, humanoid.') },
        ],
      },
    ]);
    m.form = 1;
    expect(formsView(w, data)[0]).toMatchObject({
      worn: 'War Shape',
      forms: [{ index: 0, name: 'Wolf' }],
    });
    m.form = 5;
    expect(formsView(w, data)[0]?.worn).toBeNull();
  });
});
