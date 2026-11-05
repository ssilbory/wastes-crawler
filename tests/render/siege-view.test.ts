import { describe, expect, it } from 'vitest';
import { startFactions } from '../../src/game/factions/state.ts';
import { enterRegion } from '../../src/game/world/enter-region.ts';
import type { World } from '../../src/game/world/types.ts';
import { hexCells } from '../../src/render/hex-view.ts';
import { blockadeText, campMarkers, siegeLines } from '../../src/render/siege-view.ts';
import { regionMap } from '../../src/game/world/region.ts';
import { data, siege, world } from '../game/world/helpers.ts';

/** The warhost camped before Cinderhold, the party in the Dark Lands. */
function camped(): World {
  const w = world();
  enterRegion(w, 'dark-lands', { col: 2, row: 2 });
  startFactions(w, data);
  for (const a of w.factions.warhost?.assets ?? []) a.at = 'cinderhold';
  w.sieges = [
    siege({
      next: 9,
      camps: [
        { uid: 'a1', col: 7, row: 11 },
        { uid: 'a2', col: 7, row: 12 },
      ],
    }),
  ];
  return w;
}

describe('the sieges as the party hears of them (Phase 23a)', () => {
  it('lists each siege, its camps, and its next assault', () => {
    const w = camped();
    w.day = 4;
    expect(siegeLines(w, data)).toEqual([
      "Grisk's Warhost besieges Cinderhold, held by The Free Settlements, with 3 camps: the next assault comes at the end of day 10.",
    ]);
    // An assault overdue comes tonight; one camp reads as one.
    w.day = 12;
    (w.sieges[0] as World['sieges'][number]).joined = true;
    const warhost = w.factions.warhost;
    if (warhost) warhost.assets = warhost.assets.filter((a) => a.uid === 'a1');
    expect(siegeLines(w, data)[0]).toBe(
      "Grisk's Warhost besieges Cinderhold, held by The Free Settlements, with 1 camp: the next assault comes at the end of day 13. The party has fought in it.",
    );
  });

  it('marks the camps on the siege’s own map, even under fog', () => {
    const w = camped();
    expect(campMarkers(w, data)).toEqual([
      { col: 7, row: 11, name: "Grisk's Warhost's camp before Cinderhold" },
      { col: 7, row: 12, name: "Grisk's Warhost's camp before Cinderhold" },
    ]);
    const cells = hexCells(
      regionMap(data, 'dark-lands'),
      w,
      [],
      10,
      [],
      [],
      [],
      [],
      [],
      campMarkers(w, data),
    );
    expect(cells.find((c) => c.key === '7,11')?.camp).toBe(
      "Grisk's Warhost's camp before Cinderhold",
    );
    expect(cells.find((c) => c.key === '6,11')?.camp).toBeNull();
    w.region = 'borderlands';
    expect(campMarkers(w, data)).toEqual([]);
  });

  it('shows the blockade in the town bar', () => {
    const w = camped();
    expect(blockadeText(w, 'cinderhold')).toBe('Besieged: no coaches, no new stock, prices up');
    expect(blockadeText(w, 'gutterwick')).toBeNull();
  });
});
