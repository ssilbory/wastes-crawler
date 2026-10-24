import { describe, expect, it } from 'vitest';
import type { ContentData, Dungeon, Region } from '../../../src/data/schemas/index.ts';
import { newDungeon } from '../../../src/game/dungeon/dungeon-edit.ts';
import { setCell } from '../../../src/game/dungeon/level-edit.ts';
import { contentReferenceErrors, dungeonContentErrors } from '../../../src/data/content.ts';
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

  it('finds the same new problems with the dungeon checks alone as with every check', () => {
    const broken: Dungeon = {
      ...pit,
      levels: pit.levels.map((l) => ({ ...l, map: setCell(l.map, { x: 2, y: 2 }, 'down') })),
    };
    // A shipped dungeon cut down to one level loses what quests and captives point at.
    const cut = { ...barrow, levels: barrow.levels.slice(0, 1) };
    const swaps = [[pit], [broken], [pit, { ...pit, id: 'twin' }], [cut], [barrow, barrow]];
    const fresh = (
      check: (c: ContentData) => string[],
      dungeons: Dungeon[],
      before: (c: ContentData) => string[] = check,
    ) => {
      const known = new Set(before(shipped));
      return check({ ...shipped, dungeons: [...shipped.dungeons, ...dungeons] })
        .filter((e) => !known.has(e))
        .sort();
    };
    for (const dungeons of swaps) {
      const all = fresh((c) => contentReferenceErrors(data.srd, c), dungeons);
      expect(fresh((c) => dungeonContentErrors(data.srd, c), dungeons)).toEqual(all);
      // As playable.ts checks one swap at a time: only the new dungeon's levels.
      if (dungeons.length === 1)
        expect(
          fresh(
            (c) => dungeonContentErrors(data.srd, c, dungeons[0]),
            dungeons,
            (c) => dungeonContentErrors(data.srd, c),
          ),
        ).toEqual(all);
    }
    expect(fresh((c) => dungeonContentErrors(data.srd, c), [broken]).length).toBeGreaterThan(0);
  });

  it('keeps a saved map clear of a shipped map’s town ids', () => {
    const vale = shipped.regions.find((r) => r.id === 'sealed-vale');
    const copy = { ...region, id: 'copy', sites: vale?.sites ?? [] };
    expect(worldMapErrors(data.srd, shipped, copy)).toContain(
      'regions/copy/lastward: another map has a town with this id',
    );
  });
});
