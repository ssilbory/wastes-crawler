import { describe, expect, it } from 'vitest';
import { step } from '../../../src/game/dungeon/explore.ts';
import { itemsTaken, questSteps } from '../../../src/game/world/quests.ts';
import { data } from '../world/helpers.ts';
import { below, place } from './helpers.ts';

/** The party in the upper barrow, one cell west of the torc, on the torc's step. */
const nextToTorc = () => {
  const w = below();
  w.quests['barrow-torc'] = { status: 'active', step: 2, acceptedDay: 0 };
  return place(w, 'barrow-upper', 4, 0, 'e');
};

describe('a retrieve step’s quest item', () => {
  it('is reported taken when the party walks onto its cell', () => {
    const w = nextToTorc();
    const before = questSteps(w);
    expect(step(w, data, 'forward')).toEqual({ ok: true });
    expect(itemsTaken(w, data, before)).toEqual([
      { quest: "The Barrow-King's Torc", item: "the barrow-king's torc" },
    ]);
    expect(w.quests['barrow-torc']).toMatchObject({ step: 3, status: 'ready' });
    expect(w.log.join('\n')).toContain("The party takes the barrow-king's torc.");
  });

  it('is not reported when the party moves elsewhere, or is on another step', () => {
    const w = nextToTorc();
    let before = questSteps(w);
    step(w, data, 'back');
    expect(itemsTaken(w, data, before)).toEqual([]);

    w.quests['barrow-torc'] = { status: 'active', step: 1, acceptedDay: 0 };
    place(w, 'barrow-upper', 4, 0, 'e');
    before = questSteps(w);
    step(w, data, 'forward');
    expect(itemsTaken(w, data, before)).toEqual([]);
  });

  it('reports nothing with no quests, or for a quest no longer held', () => {
    const w = nextToTorc();
    expect(itemsTaken(w, data, {})).toEqual([]);
    const before = questSteps(w);
    delete w.quests['barrow-torc'];
    expect(itemsTaken(w, data, before)).toEqual([]);
  });
});
