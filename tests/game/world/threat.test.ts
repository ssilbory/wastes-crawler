import { describe, expect, it } from 'vitest';
import { difficultySeed } from '../../../src/game/world/difficulty.ts';
import { partySetup, fighters } from '../../../src/game/world/battle-setup.ts';
import { threatSetup } from '../../../src/game/world/fight.ts';
import { warMounts } from '../../../src/game/world/mount-fights.ts';
import { buyMount, setRider } from '../../../src/game/world/mounts.ts';
import type { Mount } from '../../../src/game/world/types.ts';
import { threatText } from '../../../src/render/threat-view.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, encounter, member, world } from './helpers.ts';

describe('weighing an encounter before the fight (docs/rules-adaptation.md, XP)', () => {
  it('lines up the party as the fight would, without rolling or noting anything', () => {
    const w = world();
    expect(() => threatSetup(w, data)).toThrow('no encounter to weigh');
    w.encounter = encounter([['thug-or-militia', 'thug-or-militia']]);
    const seed = difficultySeed(w);
    const logged = w.log.length;
    expect(threatSetup(w, data)).toEqual(
      partySetup(w, data, [['thug-or-militia', 'thug-or-militia']], true),
    );
    expect(difficultySeed(w)).toBe(seed);
    expect(w.log).toHaveLength(logged);
  });

  it('counts a ridden war mount as calmed, since calming it rolls', () => {
    const w = world();
    w.purse = 10000;
    w.rng = scriptedRng([5, 5, 5, 5]);
    buyMount(w, data, 'war-boar');
    const boar = w.mounts[0] as Mount;
    setRider(w, data, boar.id, member(w, 'Grukk').id);
    expect(warMounts(w, data, fighters(w))).toEqual([boar]);
    w.encounter = encounter([['thug-or-militia']]);
    w.rng = scriptedRng([]);
    expect(threatSetup(w, data).mounts).toHaveLength(1);
  });

  it('reads the tier and the trial fights', () => {
    expect(threatText(data, { winRate: 0.824, downRate: 0.45 })).toBe(
      'Looks hard: the party wins 82% of trial fights, and someone goes down in 45%.',
    );
    expect(threatText(data, { winRate: 0.3, downRate: 0.1 })).toMatch(/^Looks deadly:/);
  });
});
