// What the surrendered can be asked (docs/rules-adaptation.md, Morale, escape, and surrender:
// After a surrender; Sam's calls, Phase 22). Below ground: the level's layout, its boss, or one
// vault or hoard. Above ground: the land about, the nearest town the party doesn't know, or the
// nearest way down it hasn't heard of, as a tavern rumor tells it. What they name shows on the map.
import { distance, hexKey } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { knownHexes, regionMap } from './region.ts';
import { rumorsLeft } from './rumors.ts';
import { locateTreasure } from './skull-locate.ts';
import { skullAnswer } from './skull.ts';
import type { World } from './types.ts';

export type PrisonerQuestion = 'map' | 'boss' | 'treasure' | 'land' | 'town' | 'dungeon';

/** What they can be asked where the party stands. */
export const prisonerQuestions = (w: World): PrisonerQuestion[] =>
  w.dungeon ? ['map', 'boss', 'treasure'] : ['land', 'town', 'dungeon'];

const byDistance = <T extends { col: number; row: number }>(w: World, list: T[]): T[] =>
  [...list].sort((a, b) => distance(w.position, a) - distance(w.position, b));

/** The nearest town the party doesn't know, charted from then on. */
function nearestTown(w: World, data: GameData): string {
  const map = regionMap(data, w.region);
  const known = knownHexes(map, w);
  const town = byDistance(
    w,
    map.sites.filter((s) => !known.has(hexKey(s))),
  )[0];
  if (!town) return 'They know of no town the party has not seen.';
  w.routes[w.region] = [...(w.routes[w.region] ?? []), hexKey(town)];
  return `They say ${town.name} lies at ${hexKey(town)}.`;
}

/** The nearest way down the party hasn't heard of, as a rumor marks it. */
function nearestWayDown(w: World, data: GameData): string {
  const way = byDistance(w, rumorsLeft(w, data))[0];
  if (!way) return 'They know of no way down the party has not heard of.';
  w.rumors.push(way.id);
  const level = way.level === null ? '' : `, fit for a party of level ${way.level}`;
  return `They tell of ${way.name}, at ${hexKey(way)}${level}.`;
}

/** Their answer to one question, put into the world (the map, the automap). */
export function prisonerAnswer(w: World, data: GameData, q: PrisonerQuestion): string {
  if (q === 'treasure') return locateTreasure(w, data);
  if (q === 'town') return nearestTown(w, data);
  if (q === 'dungeon') return nearestWayDown(w, data);
  return skullAnswer(w, data, q).replace('The dead', 'They');
}
