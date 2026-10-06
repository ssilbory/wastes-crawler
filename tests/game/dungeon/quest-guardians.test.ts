import { describe, expect, it } from 'vitest';
import { step, takeStairs } from '../../../src/game/dungeon/explore.ts';
import { canParley } from '../../../src/game/world/parley.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data } from '../world/helpers.ts';
import { below, place } from './helpers.ts';

describe('a quest’s fixed encounter', () => {
  it('is spoiling for the fight it needs, and can’t be talked down', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const w = below();
      w.rng = createRng(seed);
      w.quests['barrow-torc'] = { status: 'active', step: 0, acceptedDay: 0 };
      place(w, 'barrow-upper', 9, 0, 'w');
      takeStairs(w, data);
      w.encounter = null;
      place(w, 'barrow-lower', 7, 2, 's');
      step(w, data, 'forward');
      expect(w.encounter).toMatchObject({
        quest: 'barrow-torc',
        reaction: 'unfriendly',
        hostile: true,
      });
      expect(canParley(w, data)).toBe(false);
    }
  });
});
