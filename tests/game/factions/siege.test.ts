import { describe, expect, it } from 'vitest';
import {
  allied,
  baseStands,
  beginSiege,
  besiegers,
  campHexes,
  holders,
  pitchCamps,
  settle,
  siegeOf,
} from '../../../src/game/factions/siege.ts';
import type { World } from '../../../src/game/world/types.ts';
import { siege } from '../world/helpers.ts';
import { data, faction, factionWorld } from './helpers.ts';

/** The warhost's three fighters before Lanternfall, the party far off in the hills. */
function before(town = 'lanternfall'): World {
  const w = factionWorld();
  w.position = { col: 2, row: 2 };
  for (const a of faction(w, 'warhost').assets) a.at = town;
  return w;
}

/** The content with Lanternfall moved to the map's corner and Mirewatch beside it. */
const cornered = {
  ...data,
  content: {
    ...data.content,
    regions: data.content.regions.map((r) => ({
      ...r,
      sites: r.sites.map((s) =>
        s.id === 'lanternfall'
          ? { ...s, col: 0, row: 0 }
          : s.id === 'mirewatch'
            ? { ...s, col: 1, row: 0 }
            : s,
      ),
    })),
  },
};

describe('sieges (docs/rules-adaptation.md, Sieges)', () => {
  it('reads the besiegers, the holders, and whether the base stands', () => {
    const w = before();
    const s = siege({ town: 'lanternfall' });
    // The manufactory has no Attack, so it sits the siege out.
    expect(besiegers(w, data, s).map((a) => a.asset)).toEqual([
      'infantry',
      'scouts',
      'armed-guards',
    ]);
    expect(holders(w, s).map((a) => a.asset)).toEqual(['farmers']);
    expect(baseStands(w, s)).toBe(true);
    const gone = siege({ town: 'lanternfall', attacker: 'pirates', defender: 'nobody' });
    expect([besiegers(w, data, gone), holders(w, gone), baseStands(w, gone)]).toEqual([
      [],
      [],
      false,
    ]);
  });

  it('touches the party’s ally as attacker or defender', () => {
    expect(allied(data, siege())).toBe(true);
    expect(allied(data, siege({ attacker: 'settlements', defender: 'warhost' }))).toBe(true);
    expect(allied(data, siege({ attacker: 'bastion', defender: 'warhost' }))).toBe(false);
  });

  it('camps on the passable hexes beside a settlement, never on another or off the map', () => {
    expect(campHexes(data, 'lanternfall')).toHaveLength(6);
    expect(campHexes(data, 'atlantis')).toEqual([]);
    // In the corner, two neighbours lie off the map and one is Mirewatch.
    expect(campHexes(cornered, 'lanternfall')).toEqual([{ col: 0, row: 1 }]);
  });

  it('pitches a camp per besieger, strikes the fallen’s, and doubles up when hexes run out', () => {
    const w = before();
    const s = siege({ town: 'lanternfall' });
    pitchCamps(w, data, s);
    expect(s.camps).toEqual([
      { uid: 'a1', col: 11, row: 3 },
      { uid: 'a2', col: 11, row: 4 },
      { uid: 'a3', col: 10, row: 5 },
    ]);
    faction(w, 'warhost').assets = faction(w, 'warhost').assets.filter((a) => a.uid !== 'a2');
    pitchCamps(w, data, s);
    expect(s.camps.map((c) => c.uid)).toEqual(['a1', 'a3']);
    const crowded = siege({ town: 'lanternfall' });
    pitchCamps(w, cornered, crowded);
    expect(crowded.camps).toEqual([
      { uid: 'a1', col: 0, row: 1 },
      { uid: 'a3', col: 0, row: 1 },
    ]);
    // With nowhere to camp, the siege goes on without camps.
    const nowhere = siege({ town: 'atlantis' });
    pitchCamps(w, data, nowhere);
    expect(nowhere.camps).toEqual([]);
  });

  it('begins with the first assault a week off, heard at once when the ally is in it', () => {
    const w = before();
    w.day = 40;
    const s = beginSiege(w, data, 'warhost', 'lanternfall', 'settlements');
    expect(s).toMatchObject({ began: 40, next: 47, joined: false, pass: false, gate: null });
    expect(s.camps).toHaveLength(3);
    expect(siegeOf(w, 'lanternfall', 'warhost')).toBe(s);
    expect(siegeOf(w, 'lanternfall', 'bastion')).toBeUndefined();
    expect(w.log.at(-1)).toContain(
      "Grisk's Warhost lays siege to Lanternfall, held by The Free Settlements. The first assault comes in 7 days.",
    );
    // Rivals' sieges are only news.
    beginSiege(w, data, 'bastion', 'gutterwick', 'warhost');
    expect(w.log.at(-1)).toContain(
      'Word spreads: The Dawnwall Bastion lays siege to Gutterwick, held by',
    );
    expect(() => beginSiege(w, data, 'warhost', 'dawnwall', 'bastion')).toThrow(
      'no settlement dawnwall',
    );
  });

  it('brings the assault tonight on a party already inside, which joins it', () => {
    const w = before();
    w.region = 'dark-lands';
    w.position = { col: 10, row: 4 };
    const s = beginSiege(w, data, 'warhost', 'lanternfall', 'settlements');
    expect(s).toMatchObject({ next: w.day, joined: true });
    expect(w.log.at(-1)).toContain('The assault comes tonight.');
  });

  it('lifts once no besieger is left, paying Renown for an ally the party fought for', () => {
    const w = before();
    const s = beginSiege(w, data, 'warhost', 'lanternfall', 'settlements');
    expect(settle(w, data, s)).toBeNull();
    faction(w, 'warhost').assets = [];
    s.joined = true;
    expect(settle(w, data, s)).toBe('lifted');
    expect(w.sieges).toEqual([]);
    expect(w.renown).toBe(2);
    expect(w.log.at(-1)).toContain('Lanternfall remembers who stood with it: 2 Renown.');
    // An ally's siege the party stayed out of, or a rival's, pays nothing.
    const quiet = beginSiege(w, data, 'warhost', 'lanternfall', 'settlements');
    expect(settle(w, data, quiet)).toBe('lifted');
    const rival = siege({ town: 'gutterwick', attacker: 'bastion', defender: 'warhost' });
    rival.joined = true;
    w.sieges.push(rival);
    expect(settle(w, data, rival)).toBe('lifted');
    expect(w.renown).toBe(2);
  });

  it('falls once the defender has no assets and no base there', () => {
    const w = before();
    const s = beginSiege(w, data, 'warhost', 'lanternfall', 'settlements');
    const free = faction(w, 'settlements');
    free.assets = free.assets.filter((a) => a.at !== 'lanternfall');
    expect(settle(w, data, s)).toBeNull();
    free.bases = free.bases.filter((b) => b.at !== 'lanternfall');
    expect(settle(w, data, s)).toBe('fallen');
    expect(w.log.join('\n')).toContain("Lanternfall falls to Grisk's Warhost.");
    // The warhost holds it now (capture.ts).
    expect(w.log.at(-1)).toContain("Grisk's Warhost now holds Lanternfall.");
    expect(w.sieges).toEqual([]);
  });
});
