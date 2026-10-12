import { describe, expect, it } from 'vitest';
import type { Dungeon, Region } from '../../../src/data/schemas/index.ts';
import {
  blankRegion,
  freeHex,
  mapErrors,
  paintDanger,
  paintTerrain,
  placeDungeon,
  placeSite,
  removeSite,
  renameRegion,
  setStart,
  siteAt,
  updateSite,
} from '../../../src/game/editor/map-edit.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data } from '../world/helpers.ts';

const lands: Region = {
  id: 'lands',
  name: 'Lands',
  terrain: ['ppp', 'pLp', 'ppp'],
  overlay: ['...', '...', '...'],
  sites: [{ id: 'lands-a', name: 'A', kind: 'town', size: 'village', col: 0, row: 0 }],
  start: 'lands-a',
  exits: [],
  garrisons: [],
  encounters: {},
};
const barrow = data.content.dungeons[0] as Dungeon;
const rng = () => createRng(1);

describe('the overland map editor', () => {
  it('paints terrain and danger, inside the map only', () => {
    let r = paintTerrain(lands, { col: 2, row: 0 }, 'm');
    r = paintDanger(r, { col: 2, row: 0 }, '!');
    expect(r.terrain[0]).toBe('ppm');
    expect(r.overlay[0]).toBe('..!');
    for (const h of [
      { col: 3, row: 0 },
      { col: 0, row: 3 },
      { col: -1, row: 0 },
      { col: 0, row: -1 },
    ]) {
      expect(paintTerrain(lands, h, 'm')).toBe(lands);
      expect(paintDanger(lands, h, '!')).toBe(lands);
    }
  });

  it('places a settlement only on an empty hex on the map', () => {
    const r = placeSite(data.content, rng(), lands, { col: 2, row: 2 }, 'city');
    expect(siteAt(r, { col: 2, row: 2 })?.size).toBe('city');
    expect(placeSite(data.content, rng(), lands, { col: 0, row: 0 }, 'city')).toBe(lands);
    expect(placeSite(data.content, rng(), lands, { col: 9, row: 0 }, 'city')).toBe(lands);
  });

  it('renames and resizes settlements, ignoring a blank name', () => {
    const r = updateSite(lands, 'lands-a', { name: '  Ash  ', size: 'town' });
    expect(r.sites[0]).toMatchObject({ name: 'Ash', size: 'town' });
    expect(updateSite(r, 'lands-a', { name: ' ' }).sites[0]?.name).toBe('Ash');
    expect(updateSite(r, 'nope', { name: 'B' }).sites).toEqual(r.sites);
  });

  it('removes settlements but the last, moving the start', () => {
    expect(removeSite(lands, 'lands-a')).toBe(lands);
    const two = placeSite(data.content, rng(), lands, { col: 2, row: 2 }, 'city');
    const id = (two.sites[1] as { id: string }).id;
    expect(removeSite(two, 'lands-a')).toMatchObject({ start: id, sites: [{ id }] });
    expect(removeSite(two, id).start).toBe('lands-a');
  });

  it('sets the start only to a settlement on the map', () => {
    const two = placeSite(data.content, rng(), lands, { col: 2, row: 2 }, 'city');
    const id = (two.sites[1] as { id: string }).id;
    expect(setStart(two, id).start).toBe(id);
    expect(setStart(two, 'nope')).toBe(two);
  });

  it('renames the map, ignoring a blank name', () => {
    expect(renameRegion(lands, ' Wilds ').name).toBe('Wilds');
    expect(renameRegion(lands, ' ')).toBe(lands);
  });

  it('puts a dungeon on a hex of the map', () => {
    expect(placeDungeon(barrow, lands, { col: 2, row: 1 })).toMatchObject({
      region: 'lands',
      entrance: { col: 2, row: 1 },
    });
  });

  it('finds a free hex for an entrance nearest the middle', () => {
    const terrains = data.content.terrains;
    expect(freeHex(terrains, lands)).toEqual({ col: 1, row: 0 });
    expect(freeHex(terrains, lands, [{ col: 1, row: 0 }])).toEqual({ col: 0, row: 1 });
    expect(freeHex(terrains, { ...lands, terrain: ['L?L', 'LLL', 'LLL'] })).toBeNull();
  });

  it('checks the map and the entrances of its dungeons', () => {
    expect(mapErrors(data.srd, data.content, lands, [])).toEqual([]);
    const onLake = {
      ...lands,
      sites: [{ ...(lands.sites[0] as Region['sites'][0]), col: 1, row: 1 }],
    };
    expect(mapErrors(data.srd, data.content, onLake, [])).toEqual([
      'regions/lands/lands-a: on impassable land',
    ]);
    const inTown = placeDungeon(barrow, lands, { col: 0, row: 0 });
    const inLake = { ...placeDungeon(barrow, lands, { col: 1, row: 1 }), id: 'wet' };
    expect(mapErrors(data.srd, data.content, lands, [inTown, inLake])).toEqual([
      `dungeons/${barrow.id}: the entrance is in a town`,
      "dungeons/wet: the entrance isn't on passable land",
    ]);
  });

  it('ignores other maps and dungeons elsewhere', () => {
    const other = { ...lands, id: 'lands-2', terrain: ['LLL', 'LLL', 'LLL'] };
    const content = { ...data.content, regions: [...data.content.regions, other] };
    expect(mapErrors(data.srd, content, lands, [barrow])).toEqual([]);
  });

  it('makes a blank region of one terrain with a starting village in the middle', () => {
    const r = blankRegion(data.content, rng(), {
      id: 'wilds',
      name: 'Wilds',
      width: 6,
      height: 5,
      fill: 'f',
    });
    expect(r.terrain).toEqual(Array(5).fill('ffffff'));
    expect(r.overlay).toEqual(Array(5).fill('......'));
    expect(r.sites).toHaveLength(1);
    expect(r.sites[0]).toMatchObject({ col: 3, row: 2, size: 'village' });
    expect(r.start).toBe(r.sites[0]?.id);
    expect(mapErrors(data.srd, data.content, r, [])).toEqual([]);
  });

  it('clamps a blank region’s size, and gives its village land on water', () => {
    const r = blankRegion(data.content, rng(), {
      id: 'sea',
      name: 'Sea',
      width: 1,
      height: 99,
      fill: 'L',
    });
    expect([r.terrain[0]?.length, r.terrain.length]).toEqual([4, 60]);
    expect(r.terrain[30]).toBe('LLpL');
    expect(mapErrors(data.srd, data.content, r, [])).toEqual([]);
    const noLand = {
      ...data.content,
      terrains: data.content.terrains.filter((t) => t.movement !== 'open'),
    };
    expect(
      blankRegion(noLand, rng(), { id: 'x', name: 'X', width: 4, height: 4, fill: 'L' }).terrain[2],
    ).toBe('LLLL');
  });
});
