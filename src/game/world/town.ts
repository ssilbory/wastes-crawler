// Towns (docs/rules-adaptation.md, Progression and economy): each town keeps a ledger of crowns
// spent and loot cashed in against its thresholds, which reset on the first visit and after a
// month; reaching a new town, or a month passing, moves the purse with the economic climate. The
// ledger and prices themselves are town-prices.ts.
import { rollClimate, toTenths } from '../../rules/economy.ts';
import type { GameData } from '../character/context.ts';
import { note } from './members.ts';
import { regionMap } from './region.ts';
import { emit } from './bus.ts';
import { chartDungeon } from '../dungeon/chart.ts';
import { arriveNpcs } from './rescue.ts';
import { payShares } from './shares.ts';
import { ledger, month } from './town-prices.ts';
import type { World } from './types.ts';
import { enterRegion } from './enter-region.ts';

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
  payShares(w, data);
  arriveNpcs(w, data, site.id);
  emit(w, data, { kind: 'town-entered', town: site.id });
  if (firstVisit || w.day - w.climateDay > month(data)) climate(w, data);
}

/**
 * The party falls (Sam's call, docs/rules-adaptation.md, Overland fights): every PC in it is lost
 * for good, the stabilized and the unconscious with the dead, and can't be raised or rejoin. The
 * world moves on to the next morning at the tavern of the last town visited, where a new party
 * must be gathered; PCs left at a tavern, hirelings, mounts, the purse, and the loot are still
 * there. The night still passes for the world, so factions, crafters, raids, and quest deadlines
 * count it, unless `nightPassed` says endOfDay has already counted it (day.ts).
 */
export function wipe(w: World, data: GameData, nightPassed = false): void {
  // The last town may be in another region (Phase 12).
  const region = data.content.regions.find((r) => r.sites.some((s) => s.id === w.lastTown));
  const town = region?.sites.find((s) => s.id === w.lastTown);
  if (!region || !town) throw new Error(`unknown town ${w.lastTown}`);
  note(w, 'The party falls.');
  note(w, `${w.members.map((m) => m.character.name).join(', ')}: lost, never to be seen again.`);
  w.lost.push(...w.members.map((m) => ({ id: m.character.id, name: m.character.name })));
  w.members = [];
  // Nothing the lost party had going goes on without it.
  w.fallen = null;
  w.disguise = null;
  w.palanquin = null;
  w.pacts = null;
  if (!nightPassed) emit(w, data, { kind: 'day-passed' });
  enterRegion(w, region.id, town);
  w.encounter = null;
  w.coach = null;
  // The fallen still remember the way they came (Charts).
  chartDungeon(w, data);
  w.dungeon = null;
  w.light.lit = null;
  w.day += 1;
  w.quarter = 0;
  w.hikes = 0;
  w.noRecovery = false;
  w.camp = 'none';
  enterTown(w, data, town.id);
}
