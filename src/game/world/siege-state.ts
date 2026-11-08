// Sieges as the rest of the world reads them (Phase 23a; docs/rules-adaptation.md, Sieges): which
// settlements are besieged, and whether the party stands in one. The sieges themselves are run in
// src/game/factions/siege.ts and src/game/world/sieges.ts.
import type { Siege } from '../../data/schemas/index.ts';
import type { Hex } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { factionOf } from '../factions/state.ts';
import { regionMap } from './region.ts';
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

/**
 * The parties' allies: the campaign's (the Free Settlements) and each realm's that has one (the
 * Wastes' Well-Keepers). Their settlements never overlap, so a town names its own ally.
 */
export function allyIds(data: GameData): string[] {
  const realms = data.content.realms.flatMap((r) => (r.ally ? [r.ally] : []));
  return [data.content.siegeRules.ally, ...realms];
}

export const isAlly = (data: GameData, id: string) => allyIds(data).includes(id);

/** One ally's own settlements: its HQ and its bases in content. */
function townsOf(data: GameData, id: string): string[] {
  const ally = factionOf(data, id);
  return [ally.hq, ...ally.bases.map((b) => b.at)].filter(
    (at) => settlementOf(data, at) !== undefined,
  );
}

/** The allies' own settlements: their HQs and their bases in content (Phase 23b). */
export const allyTowns = (data: GameData): string[] =>
  allyIds(data).flatMap((id) => townsOf(data, id));

/** The ally a settlement belongs to, if any. */
export const allyOf = (data: GameData, town: string): string | null =>
  allyIds(data).find((id) => townsOf(data, id).includes(town)) ?? null;

/**
 * The faction holding one of an ally's settlements (Sieges: Capture): the ally has no base there
 * and a standing rival has one. Null for a settlement the ally holds, or that no one does.
 */
export function holderOf(w: World, data: GameData, town: string): string | null {
  const ally = allyOf(data, town);
  if (!ally || w.factions[ally]?.bases.some((b) => b.at === town)) return null;
  const holder = Object.entries(w.factions).find(
    ([id, s]) => id !== ally && s.hp > 0 && s.bases.some((b) => b.at === town),
  );
  return holder ? holder[0] : null;
}

/**
 * The side the party is on in a siege (Phase 23d): against a siege on the ally, with the ally's
 * own, and in one between two rivals the side it picked; null until it picks.
 */
export function partySide(data: GameData, s: Siege): 'attacker' | 'defender' | 'out' | null {
  if (isAlly(data, s.attacker)) return 'attacker';
  if (isAlly(data, s.defender)) return 'defender';
  return s.side ?? null;
}

/** Whether the world's realm shuts its held settlements to the party (Sam's call: the Wastes). */
export const heldShut = (w: World, data: GameData): boolean =>
  data.content.realms.some((r) => r.id === w.realm && r.heldShut === true);

/** Whether a settlement is held and shut to the party: no shop, inn, meals, or shelter. */
export const shutTo = (w: World, data: GameData, town: string): boolean =>
  heldShut(w, data) && holderOf(w, data, town) !== null;

/**
 * Whether the party stands, above ground, in a settlement that serves it: meals and shelter for
 * the night, and a town's plans. A shut held settlement is open ground (Sam's call: the Wastes).
 */
export function servedHere(w: World, data: GameData): boolean {
  const site = regionMap(data, w.region).siteAt(w.position);
  return site !== undefined && !shutTo(w, data, site.id);
}
