import { describe, expect, it } from 'vitest';
import type { ContentData, Region } from '../../../src/data/schemas/index.ts';
import { mapErrors } from '../../../src/game/editor/map-edit.ts';
import {
  generateRegion,
  largestSite,
  newSite,
  settlementName,
} from '../../../src/game/editor/map-gen.ts';
import { noiseField } from '../../../src/game/editor/noise.ts';
import { regionMapOf } from '../../../src/game/world/region.ts';
import { distance, neighbors } from '../../../src/rules/hex.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data } from '../world/helpers.ts';

const opts = { id: 'test-lands', name: 'Test Lands', width: 24, height: 18, settlements: 5 };
const gen = (seed: string | number, o = opts, content: ContentData = data.content) =>
  generateRegion(content, createRng(seed), o);

describe('noise fields for random maps', () => {
  it('spans 0 to 1 and repeats for a seed', () => {
    const f = noiseField(createRng(1), 10, 7);
    expect(f).toHaveLength(7);
    expect(f[0]).toHaveLength(10);
    expect(Math.min(...f.flat())).toBe(0);
    expect(Math.max(...f.flat())).toBe(1);
    expect(noiseField(createRng(1), 10, 7)).toEqual(f);
  });

  it('gives a one-hex field the middle value', () => {
    expect(noiseField(createRng(1), 1, 1)).toEqual([[0.5]]);
  });
});

describe('random overland regions (data/content/map-gen.json)', () => {
  it('rolls the same region from the same seed', () => {
    expect(gen('a')).toEqual(gen('a'));
    expect(gen('a')).not.toEqual(gen('b'));
  });

  it('passes the overland checks, seed after seed', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const r = gen(seed);
      expect(mapErrors(data.srd, data.content, r, []), `seed ${seed}`).toEqual([]);
      expect(r.terrain).toHaveLength(18);
      expect(r.overlay.every((row) => row.length === 24)).toBe(true);
    }
  });

  it('places the settlements asked for, spaced apart, the largest as the start', () => {
    const r = gen(7);
    expect(r.sites).toHaveLength(5);
    for (const a of r.sites)
      for (const b of r.sites)
        if (a !== b) expect(distance(a, b)).toBeGreaterThanOrEqual(data.content.mapGen.spacing);
    expect(r.start).toBe(largestSite(r.sites)?.id);
    expect(new Set(r.sites.map((s) => s.name)).size).toBe(5);
    expect(r.sites.every((s) => s.id.startsWith('test-lands-'))).toBe(true);
  });

  it('joins the settlements by road where the land allows', () => {
    const r = gen(3);
    const map = regionMapOf(data.content.terrains, r);
    for (const s of r.sites) expect(map.dangerAt(s)).toBe('road');
    expect(r.overlay.join('').split('=').length - 1).toBeGreaterThan(r.sites.length);
  });

  it('keeps the land near settlements safe', () => {
    const r = gen(11);
    const map = regionMapOf(data.content.terrains, r);
    for (let row = 0; row < map.height; row++)
      for (let col = 0; col < map.width; col++)
        if (map.dangerAt({ col, row }) === 'dangerous')
          for (const s of r.sites)
            expect(distance(s, { col, row })).toBeGreaterThan(data.content.mapGen.safeRadius);
  });

  it('clamps the size and settlement count', () => {
    const tiny = gen(1, { ...opts, width: 1, height: 2.5, settlements: 0 });
    expect([tiny.terrain[0]?.length, tiny.terrain.length, tiny.sites.length]).toEqual([4, 4, 1]);
    const huge = gen(1, { ...opts, width: 99, height: 99, settlements: 99 });
    expect([huge.terrain[0]?.length, huge.terrain.length, huge.sites.length]).toEqual([60, 60, 30]);
  });

  it('closes up the spacing when the land runs out', () => {
    const r = gen(5, { ...opts, width: 4, height: 4, settlements: 10 });
    expect(r.sites).toHaveLength(10);
  });

  it('makes land for a settlement on a map of water', () => {
    const water: ContentData = {
      ...data.content,
      mapGen: {
        ...data.content.mapGen,
        biomes: [
          { terrain: 'lake', height: [0, 1], wet: [0, 1], dangerous: false },
          {
            terrain: 'plains',
            height: [2, 2] as unknown as [number, number],
            wet: [0, 1],
            dangerous: false,
          },
        ],
      },
    };
    const r = gen(1, { ...opts, width: 6, height: 6, settlements: 3 }, water);
    expect(r.sites).toHaveLength(1);
    expect(r.terrain[3]?.[3]).toBe('p');
    expect(mapErrors(data.srd, water, r, [])).toEqual([]);
  });

  it('leaves the hex as it was when no biome has land', () => {
    const lakes: ContentData = {
      ...data.content,
      mapGen: {
        ...data.content.mapGen,
        biomes: [{ terrain: 'lake', height: [0, 1], wet: [0, 1], dangerous: true }],
      },
    };
    const r = gen(1, { ...opts, width: 4, height: 4, settlements: 1 }, lakes);
    expect(r.terrain.join('')).toBe('L'.repeat(16));
    expect(r.overlay[2]?.[2]).toBe('=');
  });

  it('falls back to the last biome, and to unknown glyphs and the first size', () => {
    const odd: ContentData = {
      ...data.content,
      mapGen: {
        ...data.content.mapGen,
        sizes: { village: 0, town: 0, city: 0 },
        biomes: [
          {
            terrain: 'hills',
            height: [2, 2] as unknown as [number, number],
            wet: [0, 1],
            dangerous: false,
          },
          {
            terrain: 'nowhere',
            height: [2, 2] as unknown as [number, number],
            wet: [0, 1],
            dangerous: false,
          },
        ],
      },
    };
    const r = gen(1, { ...opts, width: 4, height: 4, settlements: 1 }, odd);
    expect(new Set(r.terrain.join(''))).toEqual(new Set(['?']));
  });

  it('leaves a settlement cut off by water without a road', () => {
    const islands: ContentData = {
      ...data.content,
      mapGen: {
        ...data.content.mapGen,
        spacing: 1,
        biomes: [
          { terrain: 'lake', height: [0.35, 0.65], wet: [0, 1], dangerous: false },
          { terrain: 'plains', height: [0, 1], wet: [0, 1], dangerous: false },
        ],
      },
    };
    const cutOff = (r: Region) => {
      const map = regionMapOf(data.content.terrains, r);
      return r.sites.some((s) =>
        neighbors(s).every((n) => !map.inBounds(n) || map.dangerAt(n) !== 'road'),
      );
    };
    const rolls = Array.from({ length: 20 }, (_, seed) =>
      gen(seed, { ...opts, width: 12, height: 12, settlements: 8 }, islands),
    );
    expect(rolls.some(cutOff)).toBe(true);
  });

  it('rolls sizes by their odds', () => {
    const towns: ContentData = {
      ...data.content,
      mapGen: { ...data.content.mapGen, sizes: { village: 0, town: 1, city: 0 } },
    };
    expect(gen(2, opts, towns).sites.every((s) => s.size === 'town')).toBe(true);
  });
});

describe('settlement names', () => {
  const two: ContentData = {
    ...data.content,
    mapGen: { ...data.content.mapGen, names: { first: ['Ash'], second: ['ford'] } },
  };

  it('numbers a name once every pairing is taken', () => {
    expect(settlementName(two, createRng(1), [])).toBe('Ashford');
    expect(settlementName(two, createRng(1), ['Ashford'])).toBe('Ashford 2');
    expect(settlementName(two, createRng(1), ['Ashford', 'Ashford 2'])).toBe('Ashford 3');
  });

  it('gives a new site an id unique on the map', () => {
    const r: Pick<Region, 'id' | 'sites'> = { id: 'm', sites: [] };
    const a = newSite(two, createRng(1), r, { col: 1, row: 1 }, 'city');
    expect(a).toEqual({
      id: 'm-ashford',
      name: 'Ashford',
      kind: 'town',
      size: 'city',
      col: 1,
      row: 1,
    });
    const b = newSite(
      two,
      createRng(1),
      { id: 'm', sites: [{ ...a, name: 'Other' }] },
      { col: 2, row: 1 },
      'town',
    );
    expect(b.id).toBe('m-ashford-2');
  });

  it('has no largest settlement among none', () => {
    expect(largestSite([])).toBeUndefined();
  });
});
