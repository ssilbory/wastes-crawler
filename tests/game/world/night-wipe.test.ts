import { describe, expect, it } from 'vitest';
import { endQuarter } from '../../../src/game/world/quarter.ts';
import { data, world } from './helpers.ts';

describe('a night that leaves no one standing (SRD 2.5.0 strain, docs/rules-adaptation.md)', () => {
  it('falls back to the last town as a lost fight does, moving the day on once', () => {
    const w = world();
    for (const m of w.members) m.dead = true;
    w.quarter = 3;
    w.dungeon = null;
    const day = w.day;
    endQuarter(w, data);
    expect(w.log.some((l) => l.includes('The party falls.'))).toBe(true);
    expect(w.day).toBe(day + 1);
    expect(w.quarter).toBe(0);
  });

  it('is not a wipe while one PC still stands', () => {
    const w = world();
    for (const m of w.members.slice(1)) m.dead = true;
    w.quarter = 3;
    const day = w.day;
    endQuarter(w, data);
    expect(w.log.some((l) => l.includes('The party falls.'))).toBe(false);
    expect(w.day).toBe(day + 1);
  });
});
