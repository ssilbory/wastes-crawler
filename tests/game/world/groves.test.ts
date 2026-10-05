import { describe, expect, it } from 'vitest';
import { contentReferenceErrors } from '../../../src/data/content.ts';
import { hike } from '../../../src/game/world/activities.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { groveKey, grovesHere, hexesToAvoid } from '../../../src/game/world/groves.ts';
import { route, setDestination } from '../../../src/game/world/plans.ts';
import { findPath, regionMap } from '../../../src/game/world/region.ts';
import type { World } from '../../../src/game/world/types.ts';
import { hexCells } from '../../../src/render/hex-view.ts';
import { hexKey, type Hex } from '../../../src/rules/hex.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { below } from '../dungeon/helpers.ts';
import { data, encounter, world } from './helpers.ts';

const GROVE = { col: 5, row: 13 };
const grove = data.content.groves.find((g) => g.id === 'whispering-grove') as NonNullable<
  (typeof data.content.groves)[number]
>;

/** The party a hex west of the Whispering Grove, with the land around it known. */
function nearGrove(): World {
  const w = world();
  w.position = { col: 4, row: 13 };
  for (let col = 2; col <= 8; col++)
    for (let row = 11; row <= 15; row++) w.visited.add(hexKey({ col, row }));
  w.rng = createRng('grove');
  return w;
}

describe('groves of walking trees (Sam’s calls)', () => {
  it('stand on the map until cleared, marked once their hex is known', () => {
    const w = world();
    expect(grovesHere(w, data).map((g) => g.id)).toEqual(['whispering-grove']);
    const map = regionMap(data, w.region);
    const cell = (cells: ReturnType<typeof hexCells>) =>
      cells.find((c) => c.key === hexKey(GROVE))?.grove;
    expect(cell(hexCells(map, w, [], 10, [], [], grovesHere(w, data)))).toBeNull();
    w.visited.add(hexKey(GROVE));
    expect(cell(hexCells(map, w, [], 10, [], [], grovesHere(w, data)))).toBe(
      'The Whispering Grove',
    );
    w.beaten.push(groveKey(grove));
    expect(grovesHere(w, data)).toEqual([]);
  });

  it('are steered around unless the party is headed there', () => {
    const w = nearGrove();
    const map = regionMap(data, w.region);
    const east: Hex = { col: 6, row: 13 };
    expect(hexesToAvoid(w, data, east)).toEqual(new Set([hexKey(GROVE)]));
    expect(hexesToAvoid(w, data, GROVE)).toEqual(new Set());
    expect(setDestination(w, data, east)).toBe(true);
    expect(route(w, data).map(hexKey)).not.toContain(hexKey(GROVE));
    // With only a line of hexes known, avoiding the grove leaves no way through.
    const line = new Set(['4,13', '5,13', '6,13']);
    expect(findPath(map, w.position, east, line)?.map(hexKey)).toEqual(['5,13', '6,13']);
    expect(findPath(map, w.position, east, line, new Set(['5,13']))).toBeNull();
    expect(setDestination(w, data, GROVE)).toBe(true);
    expect(route(w, data).map(hexKey)).toEqual([hexKey(GROVE)]);
  });

  it('meet the party wary when it steps in, and stay cleared once the trees are beaten', () => {
    const w = nearGrove();
    setDestination(w, data, GROVE);
    hike(w, data, null, false);
    expect(w.position).toEqual(GROVE);
    expect(w.encounter).toMatchObject({
      enemies: grove.enemies,
      nature: 'wary',
      garrison: 'grove:whispering-grove',
    });
    expect(w.log.join('\n')).toContain(grove.text);
    emit(w, data, { kind: 'fight-won', quest: null, garrison: groveKey(grove) });
    expect(w.beaten).toContain('grove:whispering-grove');
    w.encounter = null;
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter).toBeNull();
  });

  it('wait while an encounter is pending, underground, or on other hexes', () => {
    const w = nearGrove();
    w.position = GROVE;
    w.encounter = encounter([['thug-or-militia']]);
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter.enemies).toEqual([['thug-or-militia']]);
    w.encounter = null;
    emit(w, data, { kind: 'day-passed' });
    expect(w.encounter).toBeNull();
    w.position = { col: 4, row: 13 };
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter).toBeNull();
    const deep = below();
    deep.position = GROVE;
    emit(deep, data, { kind: 'hex-entered' });
    expect(deep.encounter).toBeNull();
  });

  it('are checked against the regions, towns, ruins, and monsters', () => {
    const at = (over: Partial<typeof grove>) => ({
      ...data.content,
      groves: [{ ...grove, ...over }],
    });
    const errors = (over: Partial<typeof grove>) =>
      contentReferenceErrors(data.srd, at(over)).filter((e) => e.startsWith('groves/'));
    expect(errors({ region: 'atlantis' })).toEqual([
      'groves/whispering-grove: unknown region atlantis',
    ]);
    expect(errors({ col: 99 })).toEqual(['groves/whispering-grove: off the map']);
    expect(errors({ col: 3, row: 8 })).toEqual(['groves/whispering-grove: stands on a town']);
    const ruin = data.content.ruins.find((r) => r.region === 'borderlands') as {
      col: number;
      row: number;
    };
    expect(errors({ col: ruin.col, row: ruin.row })).toEqual([
      'groves/whispering-grove: stands on a ruin',
    ]);
    expect(errors({ enemies: [['ent']] })).toEqual([
      'groves/whispering-grove: unknown monster ent',
    ]);
    // A lake, a road out, and a garrison post are no place for a grove.
    expect(errors({ col: 5, row: 4 })).toEqual([
      'groves/whispering-grove: stands on impassable ground',
    ]);
    expect(errors({ col: 23, row: 8 })).toContain('groves/whispering-grove: stands on a road out');
    const posted = {
      ...data.content,
      groves: [grove],
      regions: data.content.regions.map((r) =>
        r.id === 'borderlands'
          ? { ...r, garrisons: [{ order: 'x', col: grove.col, row: grove.row, enemies: [['x']] }] }
          : r,
      ),
    };
    expect(contentReferenceErrors(data.srd, posted)).toContain(
      'groves/whispering-grove: stands on a garrison post',
    );
  });
});

describe('groves and the roads', () => {
  it('never cut a hex off from the region’s start', () => {
    for (const region of data.content.regions) {
      const w = world();
      w.region = region.id;
      const map = regionMap(data, region.id);
      const start = region.sites.find((x) => x.id === region.start) ?? (region.sites[0] as Hex);
      const all = new Set<string>();
      for (let row = 0; row < map.height; row++)
        for (let col = 0; col < map.width; col++)
          if (map.costOf({ col, row }) !== null) all.add(hexKey({ col, row }));
      const avoid = hexesToAvoid(w, data, null);
      for (const key of all) {
        if (avoid.has(key)) continue;
        const [col, row] = key.split(',').map(Number) as [number, number];
        if (findPath(map, start, { col, row }, all) === null) continue;
        expect(
          findPath(map, start, { col, row }, all, avoid),
          `${region.id} ${key}`,
        ).not.toBeNull();
      }
    }
  });
});
