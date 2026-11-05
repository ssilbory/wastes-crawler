import { describe, expect, it } from 'vitest';
import { enterRegion } from '../../src/game/world/enter-region.ts';
import type { World } from '../../src/game/world/types.ts';
import { workingsView } from '../../src/render/working-view.ts';
import { data, member, world } from '../game/world/helpers.ts';

function cinderhold(mage = true): World {
  const w = world();
  enterRegion(w, 'dark-lands', { col: 6, row: 12 });
  w.position = { col: 6, row: 12 };
  if (mage) {
    const f = member(w, 'Fizzwick');
    f.character = {
      ...f.character,
      classes: { ...f.character.classes, levels: { 'full-high-mage': 6 } },
      skills: { ...f.character.skills, magic: 1 },
    };
  }
  return w;
}

describe('Workings view (docs/rules-adaptation.md, Major projects: Workings)', () => {
  it('offers what the settlement can take, with the best lead, the price, and the time', () => {
    const w = cinderhold();
    const v = workingsView(w, data, 0);
    // Cinderhold has a workshop, a crypt, and a coach stop, but no wall.
    expect(v.offers.map((o) => o.id)).toEqual([
      'watch-lamps',
      'heatless-lamps',
      'waystones',
      'unfailing-spring',
      'grave-ward',
    ]);
    expect(v.offers[0]).toMatchObject({
      name: 'Watch-lamps',
      degree: 'trivial',
      difficulty: 12,
      lead: { name: 'Fizzwick', points: 12, help: 0 },
      cost: 240,
      days: 51,
      doubleCost: 480,
      doubleDays: 26,
      blocked: null,
    });
    expect(v.offers.find((o) => o.id === 'unfailing-spring')?.blocked).toBe(
      "Fizzwick can't design it: 12 points, and 0 of help, against 24.",
    );
    expect(workingsView(w, data, 2).offers.find((o) => o.id === 'unfailing-spring')).toMatchObject({
      lead: { help: 12 },
      cost: 680,
      blocked: null,
    });
    expect(v).toMatchObject({ hiredMost: 2, hireFee: 100, standing: [] });
  });

  it('offers nothing to lead with no caster of 6th level, and nothing off a settlement', () => {
    const w = cinderhold(false);
    const v = workingsView(w, data, 0);
    expect(v.offers[0]).toMatchObject({
      lead: null,
      blocked: 'The lead must be a spellcaster of 6th level or more.',
    });
    w.position = { col: 7, row: 12 };
    expect(workingsView(w, data, 0).offers).toEqual([]);
    w.position = { col: 6, row: 12 };
    w.dungeon = {} as World['dungeon'];
    expect(workingsView(w, data, 0).offers).toEqual([]);
    w.dungeon = null;
    w.realm = 'wastes';
    expect(workingsView(w, data, 0).offers).toEqual([]);
  });

  it('picks the caster with the most design points to lead', () => {
    const w = cinderhold();
    const l = member(w, 'Lirael');
    l.character = {
      ...l.character,
      classes: { current: 'full-high-mage', levels: { 'full-high-mage': 7 } },
      skills: { ...l.character.skills, magic: 2 },
    };
    expect(workingsView(w, data, 0).offers[0]?.lead).toMatchObject({
      name: 'Lirael',
      points: 28,
      help: 12,
    });
  });

  it('lists the Workings begun, and why one is halted', () => {
    const w = cinderhold();
    const f = member(w, 'Fizzwick');
    const row = (lead: string, done: number | null, away = 0) => ({
      working: 'watch-lamps',
      town: 'cinderhold',
      lead,
      daysLeft: 9,
      away,
      done,
    });
    w.workings = [row(f.id, null), row(f.id, 3), row(f.id, null, 31), row('gone', null)];
    expect(workingsView(w, data, 0).standing).toEqual([
      { name: 'Watch-lamps', town: 'Cinderhold', lead: 'Fizzwick', daysLeft: 9, halted: null },
      { name: 'Watch-lamps', town: 'Cinderhold', lead: 'Fizzwick', daysLeft: null, halted: null },
      {
        name: 'Watch-lamps',
        town: 'Cinderhold',
        lead: 'Fizzwick',
        daysLeft: 9,
        halted: 'its lead has been away over a month',
      },
      {
        name: 'Watch-lamps',
        town: 'Cinderhold',
        lead: 'someone gone',
        daysLeft: 9,
        halted: 'its lead is down',
      },
    ]);
    f.dead = true;
    expect(workingsView(w, data, 0).standing[0]?.halted).toBe('its lead is down');
  });
});
