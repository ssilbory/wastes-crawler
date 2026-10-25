// Water (docs/rules-adaptation.md, Water and fuel; Sam's calls after SRD 2.12.2 in vendor/wwn-srd/
// 2.0 The Rules of the Game/2.12.0 Wilderness Exploration and Expeditions.md). Water is a resource
// die like the rations, filled at any town or water hex. Only a day spent partly in dry land rolls
// it, once at the day's end; with none left the party is Thirsty that night.
import { useResource } from '../../rules/resource-die.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from './bus.ts';
import { note } from './members.ts';
import { regionMap } from './region.ts';
import type { World } from './types.ts';

const FULL = 12;

/** Fills the water die at a town or a water hex, and marks a day touched by dry land. */
export function waterHere(w: World, data: GameData): void {
  if (w.dungeon) return;
  const map = regionMap(data, w.region);
  const terrain = map.terrainAt(w.position);
  if ((terrain.water || map.siteAt(w.position)) && w.water < FULL) {
    w.water = FULL;
    note(w, 'The party fills its water.');
  }
  if (terrain.dry && !map.siteAt(w.position)) w.dryDay = true;
}

/** The bus listener: every hex entered, and every town, may fill the water or dry the day. */
export function waterListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind === 'hex-entered' || e.kind === 'town-entered') waterHere(w, data);
}

/**
 * The day's end: a day spent partly in dry land, outside town, rolls the water die. Returns whether
 * the party has gone without water (Thirsty), and starts the next day fresh.
 */
export function drinkForDay(w: World, data: GameData, inTown: boolean): boolean {
  // Standing in dry land at nightfall counts too, as a day camped in the desert does.
  waterHere(w, data);
  const dry = w.dryDay && !inTown;
  w.dryDay = false;
  if (!dry) return false;
  const use = useResource(w.rng, w.water);
  w.water = use.die;
  if (!use.available) {
    note(w, 'There is no water left.');
    return true;
  }
  if (use.die === 0) note(w, 'The last of the water is gone.');
  else if (use.roll !== null && use.roll <= 2) note(w, 'The water runs low.');
  return false;
}
