// Tavern rumors (docs/rules-adaptation.md, Towns in Phase 6a; Sam's call): for the listed price, a
// regular tells the party where one way down in the town's region lies that no quest names and the
// party hasn't seen, drawn at random. The map shows it from then on, even under fog.
import { hexKey } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { note } from './members.ts';
import { regionMap, seenHexes } from './region.ts';
import type { TownResult } from './services.ts';
import { priceHere, spend, townHere } from './town.ts';
import type { World } from './types.ts';

export interface Rumor {
  id: string;
  name: string;
  col: number;
  row: number;
  /** A ruin's party level; null for a hand-made dungeon. */
  level: number | null;
}

const no = (reason: string): TownResult => ({ ok: false, reason });

export const rumorListed = (data: GameData) => data.content.townRules.rumor;

/** Ways down in the party's region that no quest names, not yet heard of or seen. */
export function rumorsLeft(w: World, data: GameData): Rumor[] {
  const questDungeons = new Set(
    data.content.quests.flatMap((q) =>
      q.objectives.flatMap((o) => ('dungeon' in o ? [o.dungeon] : [])),
    ),
  );
  const seen = seenHexes(regionMap(data, w.region), w.visited);
  const ways: Rumor[] = [
    ...data.content.dungeons
      .filter((d) => d.region === w.region && !questDungeons.has(d.id))
      .map((d) => ({ id: d.id, name: d.name, ...d.entrance, level: null })),
    ...data.content.ruins
      .filter((r) => r.region === w.region)
      .map((r) => ({ id: r.id, name: r.name, col: r.col, row: r.row, level: r.level })),
  ];
  return ways.filter((x) => !w.rumors.includes(x.id) && !seen.has(hexKey(x)));
}

/** Buys a round in the common room for a rumor of a way down nearby. */
export function buyRumor(w: World, data: GameData): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const town = townHere(w, data);
  const left = rumorsLeft(w, data);
  if (left.length === 0) return no('The regulars know of no other ways down around here.');
  const listed = rumorListed(data);
  if (!spend(w, data, listed)) return no(`That costs ${priceHere(w, data, listed)} crowns.`);
  const r = left[w.rng.int(0, left.length - 1)] as Rumor;
  w.rumors.push(r.id);
  const level = r.level === null ? '' : `, fit for a party of level ${r.level}`;
  note(w, `Over a round in ${town.name}, a regular tells of ${r.name}, at ${hexKey(r)}${level}.`);
  return { ok: true };
}
