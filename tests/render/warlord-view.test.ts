import { describe, expect, it } from 'vitest';
import { newWorld } from '../../src/game/world/new-world.ts';
import { warlordViews } from '../../src/render/warlord-view.ts';
import { createRng } from '../../src/rules/rng.ts';
import { data, starter, world } from '../game/world/helpers.ts';

const party = [{ character: starter('snag'), row: 0, column: 0, defaultAction: 'auto' as const }];

describe('the warlords panel', () => {
  it('lists the Wastes’ warlords map by map, and who has fallen', () => {
    const w = newWorld(data, createRng('w'), party, undefined, null, 'wastes');
    w.warlords.push('scrap-king');
    const views = warlordViews(w, data);
    expect(views.map((v) => [v.name, v.fallen])).toEqual([
      ['The Scrap King', true],
      ['Vesk, the Salt Baron', false],
      ['Oduran, the Dune Khan', false],
      ['The Tallyman', false],
      ['The Sunlord', false],
    ]);
    expect(views[0]).toMatchObject({
      map: 'The Dust Fringe',
      stronghold: "The Scrap King's Pumpworks",
    });
  });

  it('shows none in the campaign or a realm without them', () => {
    expect(warlordViews(world(), data)).toEqual([]);
    const vale = newWorld(data, createRng('v'), party, undefined, null, 'sealed-vale');
    expect(warlordViews(vale, data)).toEqual([]);
  });
});
