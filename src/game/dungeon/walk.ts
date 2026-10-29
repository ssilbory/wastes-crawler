// Walking to a square the party has seen (Sam's call; docs/rules-adaptation.md, Dungeon
// exploration: Walking to a square): the shortest way through seen squares and known doors, around
// known armed traps, taken one ordinary step at a time (explore.ts, step), turning to face each.
// It stops at the square, or as soon as the step is refused, an encounter starts, the party leaves
// the level, something new comes into view, or anything makes the journal.
import { ahead, cellKey, FACINGS, type Cell, type Facing } from '../../rules/grid.ts';
import type { GameData } from '../character/context.ts';
import type { World } from '../world/types.ts';
import { step, turnParty } from './explore.ts';
import { levelOf } from './levels.ts';
import { knownEdges } from './secrets.ts';

type Underground = NonNullable<World['dungeon']>;

/** The way from the party to a seen square, one cell per step, or null if there is none. */
export function walkPath(w: World, data: GameData, to: Cell): Cell[] | null {
  const s = w.dungeon as Underground;
  // The level the party stands on has always been looked at (explore.ts, arrive).
  const seen = new Set(s.seen[s.level] as string[]);
  const traps = s.traps[s.level] ?? {};
  const open = (c: Cell) => seen.has(cellKey(c)) && traps[cellKey(c)] !== 'noticed';
  const goal = cellKey(to);
  if (!open(to)) return null;
  const edge = knownEdges(w, data);
  const from = new Map<string, Cell | null>([[cellKey(s.at), null]]);
  const queue: Cell[] = [s.at];
  for (let c = queue.shift(); c; c = queue.shift()) {
    if (cellKey(c) === goal) {
      const path: Cell[] = [];
      for (let at = c; cellKey(at) !== cellKey(s.at); at = from.get(cellKey(at)) as Cell)
        path.push(at);
      return path.reverse();
    }
    for (const side of FACINGS) {
      const e = edge(c, side);
      const next = ahead(c, side);
      if ((e !== 'open' && e !== 'door') || from.has(cellKey(next)) || !open(next)) continue;
      from.set(cellKey(next), c);
      queue.push(next);
    }
  }
  return null;
}

/** The nearest seen stairs the party can walk to, other than any it stands on. */
export function nearestStairs(w: World, data: GameData): Cell | null {
  const s = w.dungeon as Underground;
  let best: { at: Cell; length: number } | null = null;
  for (const { at } of levelOf(data, s.dungeon, s.level).level.links) {
    const path = walkPath(w, data, at);
    if (path && path.length > 0 && (!best || path.length < best.length))
      best = { at, length: path.length };
  }
  return best?.at ?? null;
}

export type WalkResult =
  | { kind: 'moved' }
  | { kind: 'arrived' }
  /** `reason` is for the player; none when what stopped it shows for itself (an encounter). */
  | { kind: 'stopped'; reason: string | null };

const TURNS = [null, 'right', 'around', 'left'] as const;

/** Faces the next cell of the way and steps into it. */
export function walkStep(w: World, data: GameData, to: Cell): WalkResult {
  const s = w.dungeon as Underground;
  if (w.encounter) return { kind: 'stopped', reason: null };
  if (cellKey(s.at) === cellKey(to)) return { kind: 'arrived' };
  const next = walkPath(w, data, to)?.[0];
  if (!next) return { kind: 'stopped', reason: 'No known way leads there.' };
  const way: Facing = next.y < s.at.y ? 'n' : next.y > s.at.y ? 's' : next.x > s.at.x ? 'e' : 'w';
  const turn = TURNS[(FACINGS.indexOf(way) - FACINGS.indexOf(s.facing) + 4) % 4];
  if (turn) turnParty(w, data, turn);
  const seen = () => (s.seen[s.level] as string[]).length;
  const before = { level: s.level, seen: seen(), log: w.log.length };
  const r = step(w, data, 'forward');
  if (!r.ok) return { kind: 'stopped', reason: r.reason };
  // A trap sprung, a message read, the light failing, or a wanderer met all make the journal.
  if (w.encounter || w.log.length > before.log || s.level !== before.level)
    return { kind: 'stopped', reason: null };
  if (seen() > before.seen) return { kind: 'stopped', reason: 'Something new comes into view.' };
  return cellKey(s.at) === cellKey(to) ? { kind: 'arrived' } : { kind: 'moved' };
}
