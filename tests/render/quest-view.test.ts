import { describe, expect, it } from 'vitest';
import { regionMap } from '../../src/game/world/region.ts';
import { hexCells } from '../../src/render/hex-view.ts';
import {
  captiveHomes,
  questStatus,
  questTargets,
  rewardText,
  townName,
} from '../../src/render/quest-view.ts';
import { addNpc } from '../../src/game/world/npcs.ts';
import { freeCaptive } from '../../src/game/world/rescue.ts';
import { questOf } from '../../src/game/world/quests.ts';
import { data, world } from '../game/world/helpers.ts';

describe('quest view', () => {
  it('marks the hexes where active steps wait, even under fog', () => {
    const w = world();
    w.quests['bandit-camp'] = { status: 'active', step: 0, acceptedDay: 0 };
    w.quests.letters = { status: 'active', step: 0, acceptedDay: 0 };
    w.quests.watchtower = { status: 'ready', step: 2, acceptedDay: 0 };
    expect(questTargets(w, data)).toEqual([
      { col: 6, row: 12 },
      { col: 17, row: 4 },
    ]);
    const cells = hexCells(regionMap(data, w.region), w, [], 10, questTargets(w, data));
    expect(cells.find((c) => c.key === '6,12')).toMatchObject({ quest: true, terrain: null });
    expect(cells.filter((c) => c.quest)).toHaveLength(2);
    w.quests['bandit-camp'] = { status: 'active', step: 1, acceptedDay: 0 };
    expect(questTargets(w, data)).toEqual([{ col: 17, row: 4 }]);
  });

  it('marks an escort or delivery destination only while the step is under way in its region', () => {
    const w = world();
    w.quests.surveyor = { status: 'active', step: 0, acceptedDay: 0 };
    expect(questTargets(w, data)).toEqual([{ col: 20, row: 8 }]);
    w.region = 'dark-lands';
    expect(questTargets(w, data)).toEqual([]);
    w.region = 'borderlands';
    w.quests.surveyor = { status: 'ready', step: 1, acceptedDay: 0 };
    expect(questTargets(w, data)).toEqual([]);
  });

  it('describes rewards and progress', () => {
    expect(rewardText(questOf(data, 'bandit-camp'))).toBe('60 crowns, 3 XP');
    expect(rewardText(questOf(data, 'watchtower'))).toBe('80 crowns, 3 XP, 2d6 loot');
    const w = world();
    expect(questStatus(w, data, 'bandit-camp')).toBe('Not taken.');
    w.quests['bandit-camp'] = { status: 'active', step: 0, acceptedDay: 0 };
    w.day = 3;
    expect(questStatus(w, data, 'bandit-camp')).toBe(
      'Break the raider camp in the forest at 6,12. 7 days left.',
    );
    w.quests.surveyor = { status: 'active', step: 0, acceptedDay: 0 };
    expect(questStatus(w, data, 'surveyor')).toBe('Bring Engineer Tamsin safely to Scrapmarch.');
    w.quests.surveyor = { status: 'active', step: 1, acceptedDay: 0 };
    expect(questStatus(w, data, 'surveyor')).toBe('');
    for (const [status, text] of [
      ['ready', 'Done: return for the reward.'],
      ['done', 'Done.'],
      ['failed', 'Failed.'],
    ] as const) {
      w.quests.letters = { status, step: 1, acceptedDay: 0 };
      expect(questStatus(w, data, 'letters')).toBe(text);
    }
  });
});

describe('captives’ homes (docs/rules-adaptation.md, NPCs)', () => {
  it('reveals and marks the home of each freed captive on the party’s map', () => {
    const w = world();
    expect(captiveHomes(w, data)).toEqual([]);
    freeCaptive(w, data, 'merchant');
    // Scrapmarch (eastmarch), far east of the starting town and unseen.
    expect(captiveHomes(w, data)).toEqual([{ col: 20, row: 8 }]);
    const map = regionMap(data, w.region);
    const fogged = hexCells(map, w, [], 18).find((c) => c.key === '20,8');
    expect(fogged).toMatchObject({ terrain: null, site: null });
    const homes = captiveHomes(w, data);
    const shown = hexCells(map, w, [], 18, homes, [], [], homes).find((c) => c.key === '20,8');
    expect(shown).toMatchObject({ site: 'Scrapmarch', quest: true, visited: false });
    expect(shown?.terrain).not.toBeNull();
  });

  it('marks none for a home in another region, nor for hirelings', () => {
    const w = world();
    freeCaptive(w, data, 'grey-priest');
    addNpc(w, data, 'hireling', 'porter', 'peaceful-human', 'Porter', false);
    expect(captiveHomes(w, data)).toEqual([]);
  });

  it('names a home town in any region, never by its id', () => {
    expect(townName(data, 'eastmarch')).toBe('Scrapmarch');
    const far = data.content.regions.find((r) => r.id !== 'borderlands')?.sites[0];
    if (!far) throw new Error('no second region');
    expect(townName(data, far.id)).toBe(far.name);
    expect(townName(data, 'nowhere')).toBe('nowhere');
  });
});
