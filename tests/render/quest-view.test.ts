import { describe, expect, it } from 'vitest';
import { regionMap } from '../../src/game/world/region.ts';
import { hexCells } from '../../src/render/hex-view.ts';
import { questStatus, questTargets, rewardText } from '../../src/render/quest-view.ts';
import { questOf } from '../../src/game/world/quests.ts';
import { data, world } from '../game/world/helpers.ts';

describe('quest view', () => {
  it('marks the hexes where active steps wait, even under fog', () => {
    const w = world();
    w.quests['bandit-camp'] = { status: 'active', step: 0, acceptedDay: 0 };
    w.quests.letters = { status: 'active', step: 0, acceptedDay: 0 };
    w.quests.watchtower = { status: 'ready', step: 2, acceptedDay: 0 };
    expect(questTargets(w, data)).toEqual([{ col: 6, row: 12 }]);
    const cells = hexCells(regionMap(data, w.region), w, [], 10, questTargets(w, data));
    expect(cells.find((c) => c.key === '6,12')).toMatchObject({ quest: true, terrain: null });
    expect(cells.filter((c) => c.quest)).toHaveLength(1);
    w.quests['bandit-camp'] = { status: 'active', step: 1, acceptedDay: 0 };
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
      'Break the bandit camp in the forest at 6,12. 7 days left.',
    );
    w.quests.surveyor = { status: 'active', step: 0, acceptedDay: 0 };
    expect(questStatus(w, data, 'surveyor')).toBe('Bring Surveyor Tamsin safely to Eastmarch.');
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
