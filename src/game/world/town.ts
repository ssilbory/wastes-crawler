// Towns (docs/rules-adaptation.md, Progression and economy): each town keeps a ledger of crowns
// spent and loot cashed in against its thresholds, which reset on the first visit and after a
// month; reaching a new town, or a month passing, moves the purse with the economic climate.
import type { Site, TownLedger } from '../../data/schemas/index.ts';
import { rollClimate, surchargedCost, toTenths } from '../../rules/economy.ts';
import { RESOURCE_DICE } from '../../rules/resource-die.ts';
import type { GameData } from '../character/context.ts';
import { note } from './members.ts';
import { regionMap } from './region.ts';
import { emit } from './bus.ts';
import { enterRegion } from './crossing.ts';
import { raidedCost } from './raids.ts';
import { arriveNpcs } from './rescue.ts';
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

const month = (data: GameData) => data.content.overlandRules.daysPerMonth;

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

/** What `listed` crowns of goods or services cost here right now. */
export function priceHere(w: World, data: GameData, listed: number): number {
  const town = townHere(w, data);
  const rules = data.content.townRules;
  const { spent } = currentLedger(w, data, town);
  const cost = surchargedCost(spent, listed, spendingThreshold(data, town), rules.surchargeRate);
  return raidedCost(w, data, town.id, cost);
}

/** Pays for `listed` crowns of goods or services from the purse; false if it can't. */
export function spend(w: World, data: GameData, listed: number): boolean {
  const cost = priceHere(w, data, listed);
  if (cost > w.purse) return false;
  w.purse = toTenths(w.purse - cost);
  ledger(w, data, townHere(w, data)).spent += listed;
  return true;
}

function climate(w: World, data: GameData): void {
  const { minPercent, maxPercent } = data.content.townRules.climate;
  const percent = rollClimate(w.rng, minPercent, maxPercent);
  w.climateDay = w.day;
  if (percent === 0 || w.purse === 0) return;
  w.purse = toTenths(Math.max(0, w.purse * (1 + percent / 100)));
  note(
    w,
    `The economic climate moves the purse ${percent > 0 ? 'up' : 'down'} ${Math.abs(percent)}%.`,
  );
}

/** Arriving in a town. The first town of a new world rolls no climate. */
export function enterTown(w: World, data: GameData, siteId: string, start = false): void {
  const site = regionMap(data, w.region).sites.find((s) => s.id === siteId);
  if (!site) throw new Error(`unknown town ${siteId}`);
  const firstVisit = w.towns[site.id] === undefined;
  ledger(w, data, site);
  w.lastTown = site.id;
  // Dungeoneering Kits restock in town (docs/rules-adaptation.md, Dungeon exploration).
  w.light.kitsReady = true;
  if (start) return;
  note(w, `The party reaches ${site.name}.`);
  arriveNpcs(w, data, site.id);
  emit(w, data, { kind: 'town-entered', town: site.id });
  if (firstVisit || w.day - w.climateDay > month(data)) climate(w, data);
}

/** The party falls: the living wake in the last town visited the next morning; the dead stay dead. */
export function wipe(w: World, data: GameData): void {
  // The last town may be in another region (Phase 12).
  const region = data.content.regions.find((r) => r.sites.some((s) => s.id === w.lastTown));
  const town = region?.sites.find((s) => s.id === w.lastTown);
  if (!region || !town) throw new Error(`unknown town ${w.lastTown}`);
  note(w, 'The party falls.');
  enterRegion(w, region.id, town);
  w.encounter = null;
  w.coach = null;
  w.dungeon = null;
  w.light.lit = null;
  w.day += 1;
  w.quarter = 0;
  w.hikes = 0;
  w.noRecovery = false;
  w.camp = 'none';
  for (const m of w.members) m.slept = false;
  enterTown(w, data, town.id);
}
