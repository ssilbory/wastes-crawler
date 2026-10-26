// Trade-route maps (docs/rules-adaptation.md, Towns in Phase 6a): a cheap map in a town's tavern
// shows the roads to the towns they reach, and every hex beside them.
import { describe, expect, it } from 'vitest';
import type { Region } from '../../../src/data/schemas/index.ts';
import { route, setDestination } from '../../../src/game/world/plans.ts';
import { knownHexes, regionMap, regionMapOf, seenHexes } from '../../../src/game/world/region.ts';
import {
  buyRouteMap,
  routeMapListed,
  routeMapRefusal,
  routesText,
  tradeRoutes,
} from '../../../src/game/world/route-maps.ts';
import { rumorsLeft } from '../../../src/game/world/rumors.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { hexCells } from '../../../src/render/hex-view.ts';
import { hexKey, neighbors } from '../../../src/rules/hex.ts';
import { data, encounter, world } from './helpers.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';

const fringe = regionMap(data, 'wastes-fringe');
const at = (map: typeof fringe, name: string) => map.sites.find((s) => s.name === name) as never;

/** Two villages on a road along row 3, with a spur up column 2 that leads nowhere. */
const spur: Region = {
  id: 'spur',
  name: 'Spur',
  terrain: Array.from({ length: 5 }, () => 'ppppppp'),
  overlay: ['..=....', '..=....', '..=....', '=======', '.......'],
  sites: [
    { id: 'west', name: 'West', kind: 'town', size: 'village', col: 0, row: 3 },
    { id: 'east', name: 'East', kind: 'town', size: 'village', col: 6, row: 3 },
  ],
  start: 'west',
  exits: [],
  garrisons: [],
  encounters: {},
};

describe('trade routes', () => {
  it('follow the roads to the first town or road out along each', () => {
    expect(tradeRoutes(fringe, at(fringe, 'Dustwell'))).toMatchObject({
      towns: ['Cistern Rest'],
      exits: [],
    });
    expect(tradeRoutes(fringe, at(fringe, 'Cistern Rest'))).toMatchObject({
      towns: ["Tinker's Oasis", 'Dustwell'],
      exits: [],
    });
    expect(tradeRoutes(fringe, at(fringe, "Tinker's Oasis"))).toMatchObject({
      towns: ['Cistern Rest'],
      exits: ['the road east to The Glassed Flats'],
    });
  });

  it('show the road and every hex beside it, and leave out roads that lead nowhere', () => {
    const map = regionMapOf(data.content.terrains, spur);
    const { towns, hexes } = tradeRoutes(map, { col: 0, row: 3 });
    expect(towns).toEqual(['East']);
    // The road along row 3 and the rows either side of it.
    const expected = new Set<string>();
    for (let col = 0; col < 7; col++)
      for (const h of [{ col, row: 3 }, ...neighbors({ col, row: 3 })])
        if (map.inBounds(h)) expected.add(hexKey(h));
    expect(hexes).toEqual(expected);
    // The spur's far end is neither road to a town nor beside one.
    expect(hexes.has('2,0')).toBe(false);
    expect(hexes.has('2,1')).toBe(false);
    const borderlands = regionMap(data, 'borderlands');
    expect(tradeRoutes(borderlands, at(borderlands, 'Grimcairn'))).toEqual({
      towns: [],
      exits: [],
      hexes: new Set(),
    });
  });

  it('read as a list of roads', () => {
    expect(routesText({ towns: ['Cistern Rest'], exits: [] })).toBe('the road to Cistern Rest');
    expect(routesText({ towns: ['Cistern Rest'], exits: ['the road east to X'] })).toBe(
      'the road to Cistern Rest and the road east to X',
    );
    expect(routesText({ towns: ['A', 'B'], exits: ['the road east to X'] })).toBe(
      'the roads to A and B, and the road east to X',
    );
    expect(routesText({ towns: ['A', 'B', 'C'], exits: [] })).toBe('the roads to A, B and C');
    expect(routesText({ towns: ['A'], exits: ['x', 'y'] })).toBe('the road to A, x and y');
    expect(routesText({ towns: ['A', 'B'], exits: ['x', 'y'] })).toBe(
      'the roads to A and B, x and y',
    );
    expect(routesText({ towns: [], exits: [] })).toBe('');
    expect(routesText({ towns: [], exits: ['the road east to X', 'the road west to Y'] })).toBe(
      'the road east to X and the road west to Y',
    );
  });
});

describe('buying a trade-route map', () => {
  it('costs the listed price and shows the roads on the map, fog or no', () => {
    const w = world();
    const map = regionMap(data, w.region);
    const before = w.purse;
    expect(routeMapListed(data)).toBe(3);
    expect(buyRouteMap(w, data)).toEqual({ ok: true });
    expect(w.purse).toBe(before - 3);
    expect(w.log.at(-1)).toContain(
      'In Rubblegate, the party buys a map of the road to Scrapmarch.',
    );
    const shown = w.routes[w.region] as string[];
    expect(shown).toContain('20,8');
    // Only hexes the party didn't already know are kept.
    const seen = seenHexes(map, w.visited);
    expect(shown.some((k) => seen.has(k))).toBe(false);
    const cells = hexCells(map, w, [], 10);
    expect(cells.find((c) => c.key === '20,8')).toMatchObject({ site: 'Scrapmarch' });
    expect(knownHexes(map, w).has('20,8')).toBe(true);
    expect(routeMapRefusal(w, data)).toBe('The party already knows these roads.');
    expect(buyRouteMap(w, data)).toEqual({
      ok: false,
      reason: 'The party already knows these roads.',
    });
  });

  it('lets the route planner follow the road through the fog', () => {
    const w = world();
    const map = regionMap(data, w.region);
    const scrapmarch = { col: 20, row: 8 };
    expect(setDestination(w, data, scrapmarch)).toBe(true);
    // Unmapped, the plan stops at the edge of what the party has seen.
    expect(route(w, data)).toHaveLength(1);
    buyRouteMap(w, data);
    const planned = route(w, data);
    expect(planned.at(-1)).toEqual(scrapmarch);
    expect(planned.every((h) => map.dangerAt(h) === 'road')).toBe(true);
  });

  it('needs a road, the crowns, and a quiet moment', () => {
    const w = world();
    expect(routeMapRefusal(w, data)).toBeNull();
    w.encounter = encounter([['thug-or-militia']]);
    expect(buyRouteMap(w, data)).toEqual({ ok: false, reason: 'Settle the encounter first.' });
    w.encounter = null;
    w.purse = 1;
    expect(buyRouteMap(w, data)).toEqual({ ok: false, reason: 'That costs 3 crowns.' });
    w.position = { col: 17, row: 4 };
    expect(routeMapRefusal(w, data)).toBe('No road leads from Grimcairn to another town.');
    expect(buyRouteMap(w, data)).toEqual({
      ok: false,
      reason: 'No road leads from Grimcairn to another town.',
    });
  });

  it('keeps each region’s maps, and counts their ways down as seen for rumors', () => {
    const w = world();
    const mine = data.content.ruins.find((r) => r.id === 'old-mine') as {
      col: number;
      row: number;
    };
    expect(rumorsLeft(w, data).map((r) => r.id)).toContain('old-mine');
    w.routes[w.region] = ['20,8', hexKey(mine)];
    expect(rumorsLeft(w, data).map((r) => r.id)).not.toContain('old-mine');
    enterRegion(w, 'dark-lands', { col: 6, row: 12 });
    expect(knownHexes(regionMap(data, 'dark-lands'), w).has('20,8')).toBe(false);
    enterRegion(w, 'borderlands', { col: 3, row: 8 });
    expect(knownHexes(regionMap(data, 'borderlands'), w).has('20,8')).toBe(true);
  });

  it('save and load, and older saves start with none', () => {
    const w = world();
    buyRouteMap(w, data);
    const loaded = parseWorld(serializeWorld(w), data);
    expect(loaded.ok && loaded.world.routes).toEqual(w.routes);
    expect(WORLD_MIGRATIONS[37]?.({ schemaVersion: 37 })).toEqual({
      schemaVersion: 38,
      routes: {},
    });
  });
});
