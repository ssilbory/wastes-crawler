// What things cost in town (docs/rules-adaptation.md, Progression and economy): each town keeps a
// ledger of crowns spent and loot cashed in against its thresholds, which reset on the first visit
// and after a month; spending past the threshold pays a surcharge, a raided settlement charges more
// for a month (Raids in Phase 12b), and a good trader haggles. Arriving in town is town.ts.
import type { Site, TownLedger } from '../../data/schemas/index.ts';
import { surchargedCost, toTenths } from '../../rules/economy.ts';
import { RESOURCE_DICE } from '../../rules/resource-die.ts';
import type { GameData } from '../character/context.ts';
import { regionMap } from './region.ts';
import { tradePercent } from './trade.ts';
import type { World } from './types.ts';

export const FULL_RATIONS = RESOURCE_DICE[RESOURCE_DICE.length - 1] as 12;

/** The town the party stands in, if any. */
export function currentTown(w: World, data: GameData): Site | undefined {
  return regionMap(data, w.region).siteAt(w.position);
}

export function townHere(w: World, data: GameData): Site {
  const town = currentTown(w, data);
  if (!town) throw new Error('the party is not in a town');
  return town;
}

export const month = (data: GameData) => data.content.overlandRules.daysPerMonth;

/** The town's ledger as it stands today: empty once a month has passed since it opened. */
export function currentLedger(w: World, data: GameData, town: Site): TownLedger {
  const open = w.towns[town.id];
  return open && w.day - open.since < month(data) ? open : { spent: 0, looted: 0, since: w.day };
}

/** The town's ledger, stored so spending and loot can be added to it. */
export function ledger(w: World, data: GameData, town: Site): TownLedger {
  const l = currentLedger(w, data, town);
  w.towns[town.id] = l;
  return l;
}

export function spendingThreshold(data: GameData, town: Site): number {
  return data.content.townRules.spendingThresholds[town.size];
}

/** What `listed` crowns of goods or services cost here right now, after the party haggles. */
export function priceHere(w: World, data: GameData, listed: number): number {
  const town = townHere(w, data);
  const rules = data.content.townRules;
  const { spent } = currentLedger(w, data, town);
  const cost = surchargedCost(spent, listed, spendingThreshold(data, town), rules.surchargeRate);
  const haggled = (raidedCost(w, data, town.id, cost) * (100 - tradePercent(w, data))) / 100;
  return toTenths(haggled);
}

/** Pays for `listed` crowns of goods or services from the purse; false if it can't. */
export function spend(w: World, data: GameData, listed: number): boolean {
  const cost = priceHere(w, data, listed);
  if (cost > w.purse) return false;
  w.purse = toTenths(w.purse - cost);
  ledger(w, data, townHere(w, data)).spent += listed;
  return true;
}

/** Whether a settlement's prices are up after a raid. */
export const isRaided = (w: World, town: string) => (w.raided[town] ?? -1) > w.day;

/** The raided surcharge on top of `cost`. */
export function raidedCost(w: World, data: GameData, town: string, cost: number): number {
  return isRaided(w, town) ? toTenths(cost * (1 + data.content.raidRules.surcharge)) : cost;
}
