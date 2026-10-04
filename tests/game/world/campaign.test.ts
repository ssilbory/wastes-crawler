import { describe, expect, it } from 'vitest';
import { enterRegion } from '../../../src/game/world/crossing.ts';
import { questOf } from '../../../src/game/world/quests.ts';
import {
  acceptQuest,
  cannotAccept,
  questBoard,
  turnInQuest,
} from '../../../src/game/world/quest-board.ts';
import { data, world } from './helpers.ts';

const CINDERHOLD = { col: 6, row: 12 };
const GUTTERWICK = { col: 16, row: 15 };

describe('the Command authority chain begins (docs/rules-adaptation.md, Campaign in Phase 12c)', () => {
  it('sends the party to Ashgate first, and to the Mire Vats only after', () => {
    const w = world();
    enterRegion(w, 'dark-lands', CINDERHOLD);
    expect(questBoard(w, data, 'elder-gorvash').map((q) => q.id)).toEqual([
      'ashgate-rolls',
      'cull-records',
    ]);
    expect(cannotAccept(w, data, questOf(data, 'cull-records'))).toBe('First: The Ashgate Rolls.');
    expect(acceptQuest(w, data, 'ashgate-rolls')).toEqual({ ok: true });
    w.quests['ashgate-rolls'] = { status: 'ready', step: 2, acceptedDay: 0 };
    expect(turnInQuest(w, data, 'ashgate-rolls')).toEqual({ ok: true });
    expect(cannotAccept(w, data, questOf(data, 'cull-records'))).toBe('Needs a party of level 2.');
  });

  it('lets Foreman Tikka stand the Ash Road patrols down with forged relief orders', () => {
    const w = world();
    enterRegion(w, 'dark-lands', GUTTERWICK);
    expect(acceptQuest(w, data, 'ash-road-relief')).toEqual({ ok: true });
    w.quests['ash-road-relief'] = { status: 'ready', step: 1, acceptedDay: 0 };
    expect(turnInQuest(w, data, 'ash-road-relief')).toEqual({ ok: true });
    expect(w.ordersEnded).toEqual(['ash-road-patrol']);
  });
});
