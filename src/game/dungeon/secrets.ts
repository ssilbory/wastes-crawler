// Secret doors (docs/rules-adaptation.md, Dungeon exploration): Search takes a turn, and the
// party's best Wis/Notice tries each unfound secret door on the edges of the party's cell and the
// cells beside it. The first time the party steps next to one it gets a free look at difficulty
// +2. A found secret door works as an ordinary door. Nothing is found in the dark.
import type { EdgeKind } from '../../data/dungeon-map.ts';
import { ahead, FACINGS, type Cell, type Facing } from '../../rules/grid.ts';
import type { GameData } from '../character/context.ts';
import { alive, bestAt, memberCheck, note } from '../world/members.ts';
import type { TownResult } from '../world/services.ts';
import type { World } from '../world/types.ts';
import { levelOf } from './explore.ts';
import { inDark } from './light.ts';
import { passTurn } from './time.ts';

export const SECRET_DIFFICULTY = 8;
export const GLIMPSE_PENALTY = 2;

const state = (w: World) => w.dungeon as NonNullable<World['dungeon']>;

/** One key per edge, shared by the two cells it divides. */
export function edgeKey(c: Cell, side: Facing): string {
  if (side === 's') return `${c.x},${c.y + 1},n`;
  if (side === 'e') return `${c.x + 1},${c.y},w`;
  return `${c.x},${c.y},${side}`;
}

/** The level's edges as the party knows them: a found secret door is a door. */
export function knownEdges(w: World, data: GameData): (c: Cell, side: Facing) => EdgeKind {
  const s = state(w);
  const { map } = levelOf(data, s.dungeon, s.level);
  const found = new Set(s.found[s.level] ?? []);
  return (c, side) => {
    const e = map.edge(c, side);
    return e === 'secret' && found.has(edgeKey(c, side)) ? 'door' : e;
  };
}

interface Hidden {
  key: string;
  difficulty: number;
}

/** Unfound secret doors on the edges of these cells. */
function hidden(w: World, data: GameData, cells: Cell[]): Hidden[] {
  const s = state(w);
  const { level, map } = levelOf(data, s.dungeon, s.level);
  const found = new Set(s.found[s.level] ?? []);
  const out = new Map<string, Hidden>();
  for (const c of cells.filter((x) => map.inBounds(x)))
    for (const side of FACINGS) {
      const key = edgeKey(c, side);
      if (map.edge(c, side) !== 'secret' || found.has(key)) continue;
      const listed = level.secrets.find((x) => edgeKey(x.at, x.side) === key);
      out.set(key, { key, difficulty: listed?.difficulty ?? SECRET_DIFFICULTY });
    }
  return [...out.values()];
}

/** The best eyes try each door; returns how many were found. */
function look(w: World, data: GameData, doors: Hidden[], extra: number): number {
  const s = state(w);
  const able = alive(w).filter((m) => m.character.hp.current > 0);
  const eyes = bestAt(data, able, 'notice', ['wis']);
  let found = 0;
  for (const d of doors) {
    if (!eyes || !memberCheck(w, data, eyes, 'notice', ['wis'], d.difficulty + extra).success)
      continue;
    s.found[s.level] = [...(s.found[s.level] ?? []), d.key];
    note(w, `${eyes.character.name} finds a secret door.`);
    found += 1;
  }
  return found;
}

/** A turn spent searching the party's cell and the cells beside it. */
export function search(w: World, data: GameData): TownResult {
  const s = w.dungeon;
  if (!s) throw new Error('the party is not in a dungeon');
  if (w.encounter) return { ok: false, reason: 'Settle the encounter first.' };
  if (inDark(w, data)) return { ok: false, reason: 'It is too dark to search.' };
  const cells = [s.at, ...FACINGS.map((f) => ahead(s.at, f))];
  if (look(w, data, hidden(w, data, cells), 0) === 0) note(w, 'The search turns up nothing.');
  passTurn(w, data);
  return { ok: true };
}

/** The free look at secret doors on the party's own cell, once each. */
export function glimpse(w: World, data: GameData): void {
  const s = state(w);
  if (inDark(w, data)) return;
  const seen = new Set(s.glimpsed[s.level] ?? []);
  const doors = hidden(w, data, [s.at]).filter((d) => !seen.has(d.key));
  if (doors.length === 0) return;
  s.glimpsed[s.level] = [...seen, ...doors.map((d) => d.key)];
  look(w, data, doors, GLIMPSE_PENALTY);
}
