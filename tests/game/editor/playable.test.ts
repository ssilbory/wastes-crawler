import { describe, expect, it } from 'vitest';
import type { Dungeon, Region } from '../../../src/data/schemas/index.ts';
import { newDungeon } from '../../../src/game/dungeon/dungeon-edit.ts';
import { setCell } from '../../../src/game/dungeon/level-edit.ts';
import { EMPTY_LIBRARY } from '../../../src/game/editor/library.ts';
import { freeHex } from '../../../src/game/editor/map-edit.ts';
import { playableContent, worldMapErrors } from '../../../src/game/editor/playable.ts';
import { data } from '../world/helpers.ts';

const shipped = data.content;
const region = shipped.regions[0] as Region;
const taken = shipped.dungeons.map((d) => d.entrance);
const hex = freeHex(shipped.terrains, region, taken) as { col: number; row: number };
const pit = newDungeon('pit', 'The Pit', region, hex);
const barrow = shipped.dungeons[0] as Dungeon;

describe('saved dungeons in the game', () => {
  it('plays the shipped content when nothing is saved', () => {
    expect(playableContent(data.srd, shipped, EMPTY_LIBRARY)).toEqual({
      content: shipped,
      skipped: {},
    });
  });

  it('adds a valid saved dungeon on a shipped map', () => {
    const { content, skipped } = playableContent(data.srd, shipped, {
      ...EMPTY_LIBRARY,
      dungeons: [pit],
    });
    expect(content.dungeons.at(-1)).toBe(pit);
    expect(skipped).toEqual({});
  });

  it('plays a saved copy of a shipped dungeon in its place', () => {
    const renamed = { ...barrow, name: 'The Older Barrow' };
    const { content } = playableContent(data.srd, shipped, {
      ...EMPTY_LIBRARY,
      dungeons: [renamed],
    });
    expect(content.dungeons[0]).toBe(renamed);
    expect(content.dungeons).toHaveLength(shipped.dungeons.length);
  });

  it('leaves out a dungeon on a saved map, a broken one, and one on another’s hex', () => {
    const elsewhere = { ...pit, id: 'far', region: 'saved-lands' };
    const broken: Dungeon = {
      ...pit,
      id: 'broken',
      levels: pit.levels.map((l) => ({ ...l, map: setCell(l.map, { x: 2, y: 2 }, 'down') })),
    };
    const twin = { ...pit, id: 'twin' };
    const { content, skipped } = playableContent(data.srd, shipped, {
      ...EMPTY_LIBRARY,
      dungeons: [elsewhere, pit, broken, twin],
    });
    expect(content.dungeons.map((d) => d.id)).not.toContain('far');
    expect(skipped).toEqual({
      far: 'it is on a map the game can’t play yet',
      broken: 'dungeons/broken/pit-1: stairs at 2,2 lead nowhere',
      twin: "dungeons/twin: the entrance is on pit's hex",
    });
  });

  it('plays a shipped world with its own dungeons, and only on that world', () => {
    const vale = shipped.worlds[0]?.map as Region;
    const { content, skipped } = playableContent(data.srd, shipped, EMPTY_LIBRARY, vale);
    expect(content.regions.at(-1)).toBe(vale);
    expect(content.dungeons.map((d) => d.id)).toContain('harrowmere');
    expect(skipped).toEqual({});
    const campaign = playableContent(data.srd, shipped, EMPTY_LIBRARY).content;
    expect(campaign.dungeons.map((d) => d.id)).not.toContain('harrowmere');
    expect(campaign.regions.map((r) => r.id)).not.toContain(vale.id);
    expect(worldMapErrors(data.srd, shipped, vale)).toEqual([]);
  });

  it('keeps a saved map clear of a shipped world’s town ids', () => {
    const copy = { ...region, id: 'copy', sites: shipped.worlds[0]?.map.sites ?? [] };
    expect(worldMapErrors(data.srd, shipped, copy)).toContain(
      'regions/copy/lastward: another map has a town with this id',
    );
  });
});
