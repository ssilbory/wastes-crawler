import { describe, expect, it } from 'vitest';
import { stashView, weightText } from '../../src/render/stash-view.ts';
import { data, world } from '../game/world/helpers.ts';

describe('the party stash', () => {
  it('shows the purse, loot dice, and components by name', () => {
    const w = world();
    // The rations weigh on the stash too; this test weighs only what it puts in.
    w.rations = 0;
    expect(stashView(w, data)).toEqual({
      purse: `${w.purse} crowns`,
      loot: 'none',
      components: [],
      weight: 'Weighs 0 Stowed items',
      dice: [],
      parts: [],
    });
    const [a, b] = data.content.components;
    if (!a || !b) throw new Error('two components needed');
    Object.assign(w, { loot: [{ count: 2, sides: 6 }], components: { [a.id]: 2, [b.id]: 1 } });
    const view = stashView(w, data);
    expect(view.loot).toBe('2d6');
    expect(view.components).toEqual([`${a.name} ×2`, b.name].sort());
    expect(view.weight).toBe('Weighs 3.5 Stowed items');
    expect(view.dice).toEqual([{ sides: 6, label: 'd6' }]);
    expect(view.parts.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('says how far past its limits the party is', () => {
    expect(weightText({ weight: 1, shares: {}, overflow: 0 })).toBe('Weighs 1 Stowed item');
    expect(weightText({ weight: 40, shares: {}, overflow: 2.5 })).toBe(
      'Weighs 40 Stowed items; the party is too heavy by 2.5',
    );
  });
});
