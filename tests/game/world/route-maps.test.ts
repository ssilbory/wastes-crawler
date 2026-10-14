// Trade-route maps (docs/rules-adaptation.md, Towns in Phase 6a): a cheap map in a town's tavern
// shows the roads to the towns they reach, with a hex either side.
import { describe, expect, it } from 'vitest';
import { enterRegion } from '../../../src/game/world/crossing.ts';
import { knownHexes, regionMap, seenHexes } from '../../../src/game/world/region.ts';
import { buyRouteMap, routeMapListed, tradeRoutes } from '../../../src/game/world/route-maps.ts';
import { rumorsLeft } from '../../../src/game/world/rumors.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { hexCells } from '../../../src/render/hex-view.ts';
import { hexKey, neighbors } from '../../../src/rules/hex.ts';
import { data, encounter, world } from './helpers.ts';

const fringe = regionMap(data, 'wastes-fringe');
const at = (map: typeof fringe, name: string) => map.sites.find((s) => s.name === name) as never;

describe('trade routes', () => {
  it('follow the roads to the first town or road out along each', () => {
    expect(tradeRoutes(fringe, at(fringe, 'Dustwell')).reached).toEqual(['Cistern Rest']);
    expect(tradeRoutes(fringe, at(fringe, 'Cistern Rest')).reached).toEqual([
      "Tinker's Oasis",
      'Dustwell',
    ]);
    expect(tradeRoutes(fringe, at(fringe, "Tinker's Oasis")).reached).toEqual([
      'the road east to The Glassed Flats',
      'Cistern Rest',
    ]);
  });

  it('show the road and a hex either side, and nothing where no road leads', () => {
    const { hexes } = tradeRoutes(fringe, at(fringe, 'Dustwell'));
    const ends = ['4,6', '16,11'];
    for (const key of ends) expect(hexes.has(key)).toBe(true);
    const road = [...hexes].filter((k) => ends.includes(k) || fringe.dangerAt(parse(k)) === 'road');
    // Each town at an end shows the land around it.
    for (const key of ends)
      for (const n of neighbors(parse(key)))
        if (fringe.inBounds(n)) expect(hexes.has(hexKey(n))).toBe(true);
    // Every hex shown is on the road or next to it.
    for (const key of hexes)
      expect(
        road.includes(key) || neighbors(parse(key)).some((n) => road.includes(hexKey(n))),
      ).toBe(true);
    const borderlands = regionMap(data, 'borderlands');
    expect(tradeRoutes(borderlands, at(borderlands, 'Grimcairn'))).toEqual({
      reached: [],
      hexes: new Set(),
    });
  });
});

function parse(key: string) {
  const [col, row] = key.split(',').map(Number) as [number, number];
  return { col, row };
}

describe('buying a trade-route map', () => {
  it('costs the listed price and shows the roads on the map, fog or no', () => {
    const w = world();
    const map = regionMap(data, w.region);
    const before = w.purse;
    expect(routeMapListed(data)).toBe(3);
    expect(buyRouteMap(w, data)).toEqual({ ok: true });
    expect(w.purse).toBe(before - 3);
    expect(w.log.at(-1)).toContain(
      'In Rubblegate, the party buys a map of the roads to Scrapmarch.',
    );
    const shown = w.routes[w.region] as string[];
    expect(shown).toContain('20,8');
    // Only hexes the party didn't already know are kept.
    const seen = seenHexes(map, w.visited);
    expect(shown.some((k) => seen.has(k))).toBe(false);
    const cells = hexCells(map, w, [], 10);
    expect(cells.find((c) => c.key === '20,8')).toMatchObject({ site: 'Scrapmarch' });
    expect(knownHexes(map, w).has('20,8')).toBe(true);
    expect(buyRouteMap(w, data)).toEqual({
      ok: false,
      reason: 'The party already knows these roads.',
    });
  });

  it('needs a road, the crowns, and a quiet moment', () => {
    const w = world();
    w.encounter = encounter([['thug-or-militia']]);
    expect(buyRouteMap(w, data)).toEqual({ ok: false, reason: 'Settle the encounter first.' });
    w.encounter = null;
    w.purse = 1;
    expect(buyRouteMap(w, data)).toEqual({ ok: false, reason: 'That costs 3 crowns.' });
    w.position = { col: 17, row: 4 };
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
