// Sieges as the rest of the world reads them (Phase 23a; docs/rules-adaptation.md, Sieges): which
// settlements are besieged, and whether the party stands in one. The sieges themselves are run in
// src/game/factions/siege.ts and src/game/world/sieges.ts.
import type { Siege } from '../../data/schemas/index.ts';
import type { Hex } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { factionOf } from '../factions/state.ts';
import type { World } from './types.ts';

/** The sieges of a settlement. */
export const siegesOf = (w: World, town: string): Siege[] =>
  w.sieges.filter((s) => s.town === town);

/** Whether a settlement is under siege: blockaded, its prices up, its shop not restocked. */
export const besieged = (w: World, town: string): boolean => w.sieges.some((s) => s.town === town);

/** The settlement on any map, by id. */
export const settlementOf = (data: GameData, id: string) =>
  data.content.regions
    .flatMap((r) => r.sites.map((site) => ({ site, region: r.id })))
    .find((x) => x.site.id === id);

/** The party stands in the settlement, above ground. */
export function partyIn(w: World, data: GameData, town: string): boolean {
  const at = settlementOf(data, town);
  return (
    at !== undefined &&
    !w.dungeon &&
    w.members.length > 0 &&
    w.region === at.region &&
    at.site.col === w.position.col &&
    at.site.row === w.position.row
  );
}

/** The siege camps on the party's map. */
export const campsHere = (w: World, data: GameData): Hex[] =>
  w.sieges
    .filter((s) => settlementOf(data, s.town)?.region === w.region)
    .flatMap((s) => s.camps.map((c) => ({ col: c.col, row: c.row })));

/** The party's ally's own settlements: its HQ and its bases in content (Phase 23b). */
export function allyTowns(data: GameData): string[] {
  const ally = factionOf(data, data.content.siegeRules.ally);
  return [ally.hq, ...ally.bases.map((b) => b.at)].filter(
    (at) => settlementOf(data, at) !== undefined,
  );
}

/**
 * The faction holding one of the ally's settlements (Sieges: Capture): the ally has no base there
 * and a standing rival has one. Null for a settlement the ally holds, or that no one does.
 */
export function holderOf(w: World, data: GameData, town: string): string | null {
  const ally = data.content.siegeRules.ally;
  if (!allyTowns(data).includes(town) || w.factions[ally]?.bases.some((b) => b.at === town))
    return null;
  const holder = Object.entries(w.factions).find(
    ([id, s]) => id !== ally && s.hp > 0 && s.bases.some((b) => b.at === town),
  );
  return holder ? holder[0] : null;
}
