// Human raids (docs/rules-adaptation.md, Raids in Phase 12b; Sam's call). Since Phase 13b a raid is
// the raiding faction's Attack on a settlement, announced a week ahead (src/game/factions/raid.ts).
// A party in that settlement, or arriving before the raid, meets the raiders at the gates; winning
// pays the settlement's reward and destroys the raiding asset. Otherwise the faction attacks on the
// raid's day, and a hit sacks the settlement, raising its prices for a month.
import type { Site } from '../../data/schemas/index.ts';
import { toTenths } from '../../rules/economy.ts';
import { raidParty, resolveRaid, routRaid } from '../factions/raid.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from './bus.ts';
import { meetGroup } from './encounters.ts';
import { note } from './members.ts';
import { regionMap } from './region.ts';
import type { World } from './types.ts';

/** The settlement under threat; content checks guarantee it is in the raided region. */
const raidSite = (data: GameData, town: string) =>
  regionMap(data, data.content.raidRules.region).sites.find((s) => s.id === town) as Site;

/** The party stands in the settlement the raiders mean to hit. */
function atRaid(w: World, data: GameData, town: string): boolean {
  const site = raidSite(data, town);
  return (
    !w.dungeon &&
    w.region === data.content.raidRules.region &&
    site.col === w.position.col &&
    site.row === w.position.row
  );
}

/** Whether a settlement's prices are up after a raid. */
export const isRaided = (w: World, town: string) => (w.raided[town] ?? -1) > w.day;

/** The raided surcharge on top of `cost`. */
export function raidedCost(w: World, data: GameData, town: string, cost: number): number {
  return isRaided(w, town) ? toTenths(cost * (1 + data.content.raidRules.surcharge)) : cost;
}

/** The raiders reach the gates while the party is there. */
function defend(w: World, data: GameData): void {
  const raid = w.raid;
  if (!raid || raid.fighting || w.encounter || !atRaid(w, data, raid.town)) return;
  raid.fighting = true;
  const site = raidSite(data, raid.town);
  meetGroup(w, data, raidParty(w, data), 'hostile', null, null, `Raiders fall on ${site.name}!`);
}

function onDay(w: World, data: GameData): void {
  const raid = w.raid;
  if (raid && w.day + 1 >= raid.day) {
    const site = raidSite(data, raid.town);
    w.raid = null;
    if (!resolveRaid(w, data, raid.town)) note(w, `${site.name} holds off the raiders.`);
  }
  // A party staying the night in the settlement is there when the raiders come.
  defend(w, data);
}

/** The raids' bus listener. */
export function raidsListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind === 'day-passed') onDay(w, data);
  else if (e.kind === 'town-entered') defend(w, data);
  else if (e.kind === 'fight-won' && w.raid?.fighting && atRaid(w, data, w.raid.town)) {
    const site = raidSite(data, w.raid.town);
    const reward = data.content.raidRules.reward;
    w.purse = toTenths(w.purse + reward);
    note(w, `${site.name} is saved. The settlement pays the defenders ${reward} crowns.`);
    routRaid(w, data);
    w.raid = null;
  }
}
