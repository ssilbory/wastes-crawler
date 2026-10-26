import { describe, expect, it } from 'vitest';
import { pickGoal } from '../../src/game/factions/goals.ts';
import { factionViews } from '../../src/render/faction-view.ts';
import { data, world } from '../game/world/helpers.ts';
import { enterRegion } from '../../src/game/world/enter-region.ts';

describe('faction view (Phase 13)', () => {
  it('shows only the factions of the region the party is in', () => {
    const w = world();
    expect(factionViews(w, data)).toEqual([]);
    enterRegion(w, 'dark-lands', { col: 7, row: 12 });
    expect(factionViews(w, data).map((v) => v.id)).toEqual([
      'warhost',
      'settlements',
      'bastion',
      'loyalists',
    ]);
    w.factions = {};
    expect(factionViews(w, data)).toEqual([]);
  });

  it('gives standing, goal, and holdings by place, or the collapse', () => {
    const w = world();
    enterRegion(w, 'dark-lands', { col: 7, row: 12 });
    pickGoal(w, data, 'bastion', 0);
    const [warhost, settlements, bastion] = factionViews(w, data);
    expect(warhost).toMatchObject({
      name: "Grisk's Warhost",
      standing: 'Force 6, Cunning 2, Wealth 4; 20 of 20 hit points, 4 Treasure',
      goal: null,
      places: [
        {
          name: "Grisk's Hold",
          holdings: [
            'Base of Influence (20 of 20)',
            'Beastman Warband (6 of 6)',
            'Predator Pack (5 of 5)',
            'Slaver Guards (3 of 3)',
            'Breeding Pens (4 of 4)',
          ],
        },
      ],
    });
    expect(settlements?.places.map((p) => p.name)).toEqual([
      'Cinderhold',
      'Gutterwick',
      'Lanternfall',
      'Mirewatch',
    ]);
    expect(bastion?.goal).toBe('Goal: Root Out the Enemy (The Free Settlements at Lanternfall)');
    pickGoal(w, data, 'warhost', 0);
    expect(factionViews(w, data)[0]?.goal).toBe('Goal: Blood the Enemy');
    const s = w.factions.warhost;
    if (!s) throw new Error('no warhost');
    Object.assign(s, { hp: 0, assets: [], bases: [] });
    expect(factionViews(w, data)[0]).toMatchObject({
      standing: 'Collapsed',
      goal: null,
      places: [],
    });
  });
});
