import { describe, expect, it } from 'vitest';
import { boardCoach, coachQuarter } from '../../../src/game/world/coach.ts';
import { restAtInn } from '../../../src/game/world/services.ts';
import { data, world } from './helpers.ts';

describe('a night in town or at a waystation that leaves no one standing', () => {
  it('ends the inn stay at the last town, moving the day on once', () => {
    const w = world();
    for (const m of w.members) m.dead = true;
    const day = w.day;
    restAtInn(w, data);
    expect(w.log.at(-1)).not.toContain('stays the night at the inn');
    expect(w.log.some((l) => l.includes('The party falls.'))).toBe(true);
    expect([w.day, w.quarter]).toEqual([day + 1, 0]);
  });

  it('ends the coach trip at the waystation, moving the day on once', () => {
    const w = world();
    w.purse = 500;
    expect(boardCoach(w, data, 'west-road')).toEqual({ ok: true });
    for (const m of w.members) m.dead = true;
    w.quarter = 3;
    const day = w.day;
    expect(coachQuarter(w, data)).toBe(true);
    expect(w.log.some((l) => l.includes('The party falls.'))).toBe(true);
    expect(w.coach).toBeNull();
    expect([w.day, w.quarter]).toEqual([day + 1, 0]);
  });
});
