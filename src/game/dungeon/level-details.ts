// The level editor's cell details (Sam's calls, Phase 17): trap details on T cells, a held captive
// on N cells or a garrison post on a floor cell, and safe camping squares. Painting a T or N gives
// it details copied from the first of their kind in the content, so the level stays valid while
// they are edited; painting over a cell removes what was on it.
import type { CellKind } from '../../data/dungeon-map.ts';
import type {
  ContentData,
  Dungeon,
  DungeonLevel,
  GarrisonPost,
  HeldCaptive,
  Trap,
} from '../../data/schemas/index.ts';
import type { Cell } from '../../rules/grid.ts';
import { setCell } from './level-edit.ts';

const at = (c: Cell) => (x: { at: Cell }) => x.at.x === c.x && x.at.y === c.y;
const not = (c: Cell) => (x: { at: Cell }) => !at(c)(x);

function level(d: Dungeon, levelId: string): DungeonLevel {
  const l = d.levels.find((x) => x.id === levelId);
  if (!l) throw new Error(`unknown level ${levelId}`);
  return l;
}

const withLevel = (d: Dungeon, levelId: string, change: (l: DungeonLevel) => DungeonLevel) => ({
  ...d,
  levels: d.levels.map((l) => (l.id === levelId ? change(l) : l)),
});

/** The first of each kind of detail in the content, to start a new one from. */
function templates(content: ContentData) {
  const levels = content.dungeons.flatMap((d) => d.levels);
  const first = <T>(list: T[], kind: string): T => {
    const found = list[0];
    if (found === undefined) throw new Error(`the content has no ${kind} to copy`);
    return found;
  };
  return {
    trap: first(
      levels.flatMap((l) => l.traps),
      'trap',
    ),
    captive: first(
      levels.flatMap((l) => l.captives),
      'held captive',
    ),
    garrison: first(
      levels.flatMap((l) => l.garrisons),
      'garrison post',
    ),
  };
}

/** What a cell holds besides its glyph. */
export interface CellDetails {
  trap: Trap | null;
  captive: HeldCaptive | null;
  garrison: GarrisonPost | null;
  safe: boolean;
}

export function cellDetails(d: Dungeon, levelId: string, c: Cell): CellDetails {
  const l = level(d, levelId);
  return {
    trap: l.traps.find(at(c)) ?? null,
    captive: l.captives.find(at(c)) ?? null,
    garrison: l.garrisons.find(at(c)) ?? null,
    safe: l.safe.some((s) => s.x === c.x && s.y === c.y),
  };
}

/** Paints a cell and keeps its details in step: new ones for a T or N, none for anything else. */
export function paintCell(
  content: ContentData,
  d: Dungeon,
  levelId: string,
  c: Cell,
  kind: CellKind,
): Dungeon {
  const t = templates(content);
  return withLevel(d, levelId, (l) => {
    const trap = l.traps.find(at(c));
    const captive = l.captives.find(at(c));
    return {
      ...l,
      map: setCell(l.map, c, kind),
      traps: [
        ...l.traps.filter(not(c)),
        ...(kind === 'trap' ? [trap ?? { ...t.trap, at: c }] : []),
      ],
      captives: [
        ...l.captives.filter(not(c)),
        ...(kind === 'npc' ? [captive ?? { ...t.captive, at: c }] : []),
      ],
      garrisons: l.garrisons.filter(not(c)),
    };
  });
}

/** Makes the cell's NPC a held captive (an N) or a garrison post (on plain floor). */
export function setNpcKind(
  content: ContentData,
  d: Dungeon,
  levelId: string,
  c: Cell,
  kind: 'captive' | 'guard',
): Dungeon {
  if (kind === 'captive') return paintCell(content, d, levelId, c, 'npc');
  const existing = level(d, levelId).garrisons.find(at(c));
  const floor = paintCell(content, d, levelId, c, 'floor');
  const post = existing ?? { ...templates(content).garrison, at: c };
  return withLevel(floor, levelId, (l) => ({ ...l, garrisons: [...l.garrisons, post] }));
}

/** Replaces the trap on its cell. */
export const setTrap = (d: Dungeon, levelId: string, trap: Trap) =>
  withLevel(d, levelId, (l) => ({ ...l, traps: [...l.traps.filter(not(trap.at)), trap] }));

/** Replaces the held captive on its cell. */
export const setCaptive = (d: Dungeon, levelId: string, captive: HeldCaptive) =>
  withLevel(d, levelId, (l) => ({
    ...l,
    captives: [...l.captives.filter(not(captive.at)), captive],
  }));

/** Replaces the garrison post on its cell. */
export const setGarrison = (d: Dungeon, levelId: string, post: GarrisonPost) =>
  withLevel(d, levelId, (l) => ({
    ...l,
    garrisons: [...l.garrisons.filter(not(post.at)), post],
  }));

/** Makes a cell a safe camping square, or not. */
export const setSafe = (d: Dungeon, levelId: string, c: Cell, safe: boolean) =>
  withLevel(d, levelId, (l) => ({
    ...l,
    safe: [...l.safe.filter((s) => s.x !== c.x || s.y !== c.y), ...(safe ? [c] : [])],
  }));
