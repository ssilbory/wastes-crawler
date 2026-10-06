import { describe, expect, it } from 'vitest';
import { stashView } from '../../src/render/stash-view.ts';
import { data, world } from '../game/world/helpers.ts';

describe('the party stash', () => {
  it('shows the purse, loot dice, and components by name', () => {
    const w = world();
    expect(stashView(w, data)).toEqual({
      purse: `${w.purse} crowns`,
      loot: 'none',
      components: [],
    });
    const [a, b] = data.content.components;
    if (!a || !b) throw new Error('two components needed');
    Object.assign(w, { loot: [{ count: 2, sides: 6 }], components: { [a.id]: 2, [b.id]: 1 } });
    const view = stashView(w, data);
    expect(view.loot).toBe('2d6');
    expect(view.components).toEqual([`${a.name} ×2`, b.name].sort());
  });
});
