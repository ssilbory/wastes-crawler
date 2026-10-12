import { describe, expect, it } from 'vitest';
import type { Dungeon, Region } from '../../../src/data/schemas/index.ts';
import {
  deleteDungeon,
  deleteRegion,
  EMPTY_LIBRARY,
  importDungeons,
  libraryText,
  parseLibrary,
  saveDungeon,
  saveRegion,
  slug,
  uniqueId,
  withLibrary,
} from '../../../src/game/editor/library.ts';
import { data } from '../world/helpers.ts';

const barrow = data.content.dungeons[0] as Dungeon;
const borderlands = data.content.regions[0] as Region;
const mine: Dungeon = { ...barrow, id: 'mine', name: 'Mine' };
const lands: Region = { ...borderlands, id: 'lands', name: 'Lands' };

describe('the editors’ saved work', () => {
  it('starts empty, and round-trips through its text', () => {
    expect(parseLibrary(null)).toEqual({ library: EMPTY_LIBRARY, errors: [] });
    const lib = saveRegion(saveDungeon(EMPTY_LIBRARY, mine), lands);
    expect(parseLibrary(libraryText(lib))).toEqual({ library: lib, errors: [] });
  });

  it('says when the text is unreadable or in an unknown format', () => {
    expect(parseLibrary('{').errors).toEqual(['the saved editor work is not readable JSON']);
    expect(parseLibrary('{"version":2}').errors).toEqual([
      'the saved editor work is not in a known format',
    ]);
  });

  it('drops only the records that no longer load', () => {
    const text = JSON.stringify({
      version: 1,
      dungeons: [mine, { id: 'broken' }, null],
      regions: [lands, 7],
    });
    const { library, errors } = parseLibrary(text);
    expect(library).toEqual({ dungeons: [mine], regions: [lands] });
    expect(errors).toEqual([
      'saved dungeon broken no longer loads',
      'saved dungeon #3 no longer loads',
      'saved map #2 no longer loads',
    ]);
  });

  it('saves over a record with the same id, and deletes', () => {
    let lib = saveDungeon(saveDungeon(EMPTY_LIBRARY, mine), barrow);
    lib = saveDungeon(lib, { ...mine, name: 'Deeper mine' });
    expect(lib.dungeons.map((d) => d.name)).toEqual(['Deeper mine', barrow.name]);
    lib = deleteDungeon(lib, barrow.id);
    lib = saveRegion(saveRegion(lib, lands), { ...lands, name: 'Wilds' });
    expect(lib.regions.map((r) => r.name)).toEqual(['Wilds']);
    expect(deleteDungeon(lib, 'mine').dungeons).toEqual([]);
    expect(deleteRegion(lib, 'lands').regions).toEqual([]);
  });

  it('stands saved records in for shipped ones, and adds the rest', () => {
    const lib = {
      dungeons: [{ ...barrow, name: 'Edited' }, mine],
      regions: [lands],
    };
    const content = withLibrary(data.content, lib);
    expect(content.dungeons[0]?.name).toBe('Edited');
    expect(content.dungeons).toHaveLength(data.content.dungeons.length + 1);
    expect(content.regions.at(-1)).toBe(lands);
  });

  it('makes ids from names', () => {
    expect(slug('  The Old  Mine!  ', 'x')).toBe('the-old-mine');
    expect(slug('!!!', 'dungeon')).toBe('dungeon');
    expect(uniqueId('mine', [])).toBe('mine');
    expect(uniqueId('mine', ['mine', 'mine-2'])).toBe('mine-3');
  });
});

describe('importing dungeons', () => {
  it('takes one dungeon or a list', () => {
    expect(importDungeons(JSON.stringify(mine))).toEqual({ dungeons: [mine], errors: [] });
    const { dungeons, errors } = importDungeons(JSON.stringify([mine, { id: 'x' }]));
    expect(dungeons).toEqual([mine]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^dungeon #2 is not a dungeon: /);
  });

  it('says when the file is not JSON', () => {
    expect(importDungeons('nope')).toEqual({
      dungeons: [],
      errors: ['the file is not readable JSON'],
    });
  });
});
