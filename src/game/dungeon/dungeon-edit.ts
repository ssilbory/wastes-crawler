// The level editor's dungeon-wide edits (Sam's calls): a new dungeon, its name and levels, where
// its stairs lead, where the party comes in, and each level's wandering check. Cell painting and
// cell details are in level-edit.ts and level-details.ts.
import type {
  Dungeon,
  DungeonLevel,
  Facing,
  Region,
  StairsLink,
} from '../../data/schemas/index.ts';
import type { Cell } from '../../rules/grid.ts';
import { blankMap, setCell } from './level-edit.ts';

const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

function emptyLevel(id: string, name: string, map: string[]): DungeonLevel {
  return {
    id,
    name,
    map,
    links: [],
    wander: null,
    safe: [],
    secrets: [],
    traps: [],
    specials: [],
    captives: [],
    garrisons: [],
  };
}

/**
 * A one-level dungeon on a map's hex: a walled 6 × 6 level whose corner cell holds the stairs up to
 * the surface, where the party comes in.
 */
export function newDungeon(
  id: string,
  name: string,
  region: Region,
  entrance: { col: number; row: number },
): Dungeon {
  const levelId = `${id}-1`;
  const at = { x: 0, y: 0 };
  const level = emptyLevel(levelId, 'Level 1', setCell(blankMap(6, 6), at, 'up'));
  return {
    id,
    name,
    region: region.id,
    entrance,
    entry: { level: levelId, at, facing: 's' },
    levels: [{ ...level, links: [{ at, to: { surface: true } }] }],
  };
}

export const renameDungeon = (d: Dungeon, name: string): Dungeon =>
  name.trim() ? { ...d, name: name.trim() } : d;

/** A new walled level of the given size at the bottom, with an id unused in the dungeon. */
export function addLevel(d: Dungeon, width = 6, height = 6): Dungeon {
  let n = d.levels.length + 1;
  while (d.levels.some((l) => l.id === `${d.id}-${n}`)) n += 1;
  return {
    ...d,
    levels: [...d.levels, emptyLevel(`${d.id}-${n}`, `Level ${n}`, blankMap(width, height))],
  };
}

const withLevel = (d: Dungeon, id: string, change: (l: DungeonLevel) => DungeonLevel): Dungeon => ({
  ...d,
  levels: d.levels.map((l) => (l.id === id ? change(l) : l)),
});

export const renameLevel = (d: Dungeon, id: string, name: string): Dungeon =>
  name.trim() ? withLevel(d, id, (l) => ({ ...l, name: name.trim() })) : d;

/** Whether a level can go: never the last one, nor the one the party comes in on. */
export const canRemoveLevel = (d: Dungeon, id: string) =>
  d.levels.length > 1 && d.entry.level !== id;

/** Removes a level, and every stairs link and teleporter that went to it. */
export function removeLevel(d: Dungeon, id: string): Dungeon {
  if (!canRemoveLevel(d, id)) return d;
  return {
    ...d,
    levels: d.levels
      .filter((l) => l.id !== id)
      .map((l) => ({
        ...l,
        links: l.links.filter((k) => !('level' in k.to) || k.to.level !== id),
        specials: l.specials.filter((s) => s.kind !== 'teleporter' || s.to.level !== id),
      })),
  };
}

/** Moves a level one place up or down the list; the first level is listed first in the game. */
export function moveLevel(d: Dungeon, id: string, by: -1 | 1): Dungeon {
  const i = d.levels.findIndex((l) => l.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= d.levels.length) return d;
  const levels = [...d.levels];
  [levels[i], levels[j]] = [levels[j] as DungeonLevel, levels[i] as DungeonLevel];
  return { ...d, levels };
}

export const linkAt = (d: Dungeon, levelId: string, c: Cell): StairsLink | undefined =>
  d.levels.find((l) => l.id === levelId)?.links.find((k) => same(k.at, c));

/** Sets where the stairs on a cell lead, or clears the link with null. */
export const setLink = (d: Dungeon, levelId: string, c: Cell, to: StairsLink['to'] | null) =>
  withLevel(d, levelId, (l) => ({
    ...l,
    links: [...l.links.filter((k) => !same(k.at, c)), ...(to ? [{ at: c, to }] : [])],
  }));

const OPPOSITE: Record<Facing, Facing> = { n: 's', s: 'n', e: 'w', w: 'e' };

/**
 * Links stairs to stairs both ways: each leads to the other, the party facing as it was on taking
 * them. Facings are kept from any existing link.
 */
export function linkBothWays(
  d: Dungeon,
  from: { level: string; at: Cell },
  to: { level: string; at: Cell },
  facing: Facing,
): Dungeon {
  const there = setLink(d, from.level, from.at, { level: to.level, at: to.at, facing });
  const back = linkAt(d, to.level, to.at);
  const backFacing = back && 'level' in back.to ? back.to.facing : OPPOSITE[facing];
  return setLink(there, to.level, to.at, { level: from.level, at: from.at, facing: backFacing });
}

/** Where the party stands on coming down from the surface. */
export const setEntry = (d: Dungeon, levelId: string, at: Cell, facing: Facing): Dungeon => ({
  ...d,
  entry: { level: levelId, at, facing },
});

/** A level's wandering check: every so many turns on a table, or none. */
export const setWander = (d: Dungeon, levelId: string, wander: DungeonLevel['wander']) =>
  withLevel(d, levelId, (l) => ({ ...l, wander }));

/** The dungeon with a new id and name, its level ids following, for saving as a copy. */
export function copyDungeon(d: Dungeon, id: string, name: string): Dungeon {
  const ids = new Map(
    d.levels.map((l) => [
      l.id,
      l.id.startsWith(`${d.id}-`) ? `${id}${l.id.slice(d.id.length)}` : `${id}-${l.id}`,
    ]),
  );
  const re = (level: string) => ids.get(level) ?? level;
  return {
    ...d,
    id,
    name,
    entry: { ...d.entry, level: re(d.entry.level) },
    levels: d.levels.map((l) => ({
      ...l,
      id: re(l.id),
      links: l.links.map((k) =>
        'level' in k.to ? { ...k, to: { ...k.to, level: re(k.to.level) } } : k,
      ),
      specials: l.specials.map((s) =>
        s.kind === 'teleporter' ? { ...s, to: { ...s.to, level: re(s.to.level) } } : s,
      ),
    })),
  };
}
