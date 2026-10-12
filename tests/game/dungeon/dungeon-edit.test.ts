import { describe, expect, it } from 'vitest';
import type { Dungeon, Region } from '../../../src/data/schemas/index.ts';
import {
  addLevel,
  canRemoveLevel,
  copyDungeon,
  linkAt,
  linkBothWays,
  moveLevel,
  newDungeon,
  removeLevel,
  renameDungeon,
  renameLevel,
  setEntry,
  setLink,
  setWander,
} from '../../../src/game/dungeon/dungeon-edit.ts';
import { editorErrors, setCell, setEdge } from '../../../src/game/dungeon/level-edit.ts';
import { data } from '../world/helpers.ts';

const region = data.content.regions[0] as Region;
const fresh = () => newDungeon('pit', 'The Pit', region, { col: 1, row: 1 });
const errors = (d: Dungeon) => editorErrors(data.content, d, data.srd);
const at = { x: 0, y: 0 };

/**
 * A two-level dungeon: stairs down at 1,0 on the first, open to the entry at 0,0, and stairs up at
 * 0,0 on the second.
 */
function twoLevels(): Dungeon {
  const d = addLevel(fresh());
  return {
    ...d,
    levels: d.levels.map((l, i) => ({
      ...l,
      map:
        i === 0
          ? setEdge(setCell(l.map, { x: 1, y: 0 }, 'down'), at, 'e', 'open')
          : setCell(l.map, at, 'up'),
    })),
  };
}

describe('dungeon-wide edits in the level editor', () => {
  it('starts a new dungeon that is valid, with stairs up to the surface', () => {
    const d = fresh();
    expect(d.entry).toEqual({ level: 'pit-1', at, facing: 's' });
    expect(linkAt(d, 'pit-1', at)?.to).toEqual({ surface: true });
    expect(errors(d)).toEqual([]);
  });

  it('renames the dungeon and its levels, ignoring blank names', () => {
    expect(renameDungeon(fresh(), ' Deep Pit ').name).toBe('Deep Pit');
    expect(renameDungeon(fresh(), ' ').name).toBe('The Pit');
    expect(renameLevel(fresh(), 'pit-1', ' Top ').levels[0]?.name).toBe('Top');
    expect(renameLevel(fresh(), 'pit-1', '').levels[0]?.name).toBe('Level 1');
  });

  it('adds levels with unused ids, walled and valid', () => {
    let d = addLevel(fresh(), 3, 2);
    expect(d.levels.map((l) => l.id)).toEqual(['pit-1', 'pit-2']);
    expect(d.levels[1]?.map).toHaveLength(5);
    d = removeLevel(addLevel(d), 'pit-2');
    expect(addLevel(d).levels.map((l) => l.id)).toEqual(['pit-1', 'pit-3', 'pit-4']);
    expect(errors(d)).toEqual([]);
  });

  it('removes a level and what led to it, but never the entry level or the last', () => {
    let d = twoLevels();
    d = setLink(d, 'pit-1', { x: 1, y: 0 }, { level: 'pit-2', at, facing: 'n' });
    d = {
      ...d,
      levels: d.levels.map((l, i) =>
        i === 0
          ? {
              ...l,
              specials: [
                { kind: 'teleporter', at: { x: 2, y: 2 }, to: { level: 'pit-2', at, facing: 'n' } },
                { kind: 'spinner', at: { x: 3, y: 3 } },
              ],
            }
          : l,
      ),
    };
    expect(canRemoveLevel(d, 'pit-1')).toBe(false);
    expect(removeLevel(d, 'pit-1')).toBe(d);
    const gone = removeLevel(d, 'pit-2');
    expect(gone.levels.map((l) => l.id)).toEqual(['pit-1']);
    expect(gone.levels[0]?.links).toEqual([{ at, to: { surface: true } }]);
    expect(gone.levels[0]?.specials).toEqual([{ kind: 'spinner', at: { x: 3, y: 3 } }]);
    expect(canRemoveLevel(fresh(), 'pit-1')).toBe(false);
  });

  it('moves levels up and down the list, within it', () => {
    const d = twoLevels();
    expect(moveLevel(d, 'pit-2', -1).levels.map((l) => l.id)).toEqual(['pit-2', 'pit-1']);
    expect(moveLevel(d, 'pit-1', 1).levels.map((l) => l.id)).toEqual(['pit-2', 'pit-1']);
    expect(moveLevel(d, 'pit-1', -1)).toBe(d);
    expect(moveLevel(d, 'pit-2', 1)).toBe(d);
    expect(moveLevel(d, 'nope', 1)).toBe(d);
  });

  it('links stairs, replaces links, and clears them', () => {
    let d = twoLevels();
    expect(errors(d)).toContain('dungeons/pit/pit-1: stairs at 1,0 lead nowhere');
    d = setLink(d, 'pit-1', { x: 1, y: 0 }, { level: 'pit-2', at, facing: 'e' });
    d = setLink(d, 'pit-2', at, { level: 'pit-1', at: { x: 1, y: 0 }, facing: 'w' });
    expect(errors(d)).toEqual([]);
    d = setLink(d, 'pit-1', { x: 1, y: 0 }, null);
    expect(linkAt(d, 'pit-1', { x: 1, y: 0 })).toBeUndefined();
    expect(linkAt(d, 'nope', at)).toBeUndefined();
  });

  it('links stairs both ways, keeping the facing of a link already there', () => {
    let d = linkBothWays(
      twoLevels(),
      { level: 'pit-1', at: { x: 1, y: 0 } },
      { level: 'pit-2', at },
      'e',
    );
    expect(linkAt(d, 'pit-2', at)?.to).toEqual({ level: 'pit-1', at: { x: 1, y: 0 }, facing: 'w' });
    expect(errors(d)).toEqual([]);
    d = setLink(d, 'pit-2', at, { level: 'pit-1', at: { x: 1, y: 0 }, facing: 'n' });
    d = linkBothWays(d, { level: 'pit-1', at: { x: 1, y: 0 } }, { level: 'pit-2', at }, 's');
    expect(linkAt(d, 'pit-2', at)?.to).toMatchObject({ facing: 'n' });
    const surface = linkBothWays(
      setLink(twoLevels(), 'pit-2', at, { surface: true }),
      { level: 'pit-1', at: { x: 1, y: 0 } },
      { level: 'pit-2', at },
      'w',
    );
    expect(linkAt(surface, 'pit-2', at)?.to).toMatchObject({ facing: 'e' });
  });

  it('moves the entry and sets a level’s wanderers', () => {
    const d = setEntry(fresh(), 'pit-1', { x: 2, y: 3 }, 'w');
    expect(d.entry).toEqual({ level: 'pit-1', at: { x: 2, y: 3 }, facing: 'w' });
    const table = data.content.encounterTables[0]?.id as string;
    const w = setWander(d, 'pit-1', { every: 3, table });
    expect(w.levels[0]?.wander).toEqual({ every: 3, table });
    expect(setWander(w, 'pit-1', null).levels[0]?.wander).toBeNull();
  });

  it('copies a dungeon under a new id, its level ids and links following', () => {
    const barrow = data.content.dungeons[0] as Dungeon;
    const copy = copyDungeon(barrow, 'barrow-two', 'Barrow Two');
    expect(copy.name).toBe('Barrow Two');
    expect(copy.levels.every((l) => l.id.startsWith('barrow-two'))).toBe(true);
    // Still on the original's hex, until the editor moves it.
    expect(errors(copy)).toEqual([`dungeons/barrow-two: the entrance is on ${barrow.id}'s hex`]);
    const odd = copyDungeon({ ...fresh(), id: 'other' }, 'x', 'X');
    expect(odd.levels[0]?.id).toBe('x-pit-1');
    expect(odd.entry.level).toBe('x-pit-1');
    const linked = setLink(
      twoLevels(),
      'pit-1',
      { x: 1, y: 0 },
      { level: 'gone', at, facing: 'n' },
    );
    const tele = {
      ...linked,
      levels: linked.levels.map((l) => ({
        ...l,
        specials: [
          { kind: 'teleporter' as const, at, to: { level: 'pit-2', at, facing: 'n' as const } },
        ],
      })),
    };
    const c = copyDungeon(tele, 'hole', 'Hole');
    expect(linkAt(c, 'hole-1', { x: 1, y: 0 })?.to).toMatchObject({ level: 'gone' });
    expect(c.levels[0]?.specials[0]).toMatchObject({ to: { level: 'hole-2' } });
  });
});
