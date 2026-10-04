// Travel between regions (docs/rules-adaptation.md, Regions in Phase 12; Sam's call: new worlds
// start in the Borderlands, and a road leads on into the Dark Lands, both ways). Each region keeps
// its own explored hexes; taking the road is a quarter day.
import { hexKey } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { note } from './members.ts';
import { endQuarter } from './quarter.ts';
import { regionMap } from './region.ts';
import type { TownResult } from './services.ts';
import type { World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Moves the party into another region, its explored hexes swapped in. */
export function enterRegion(w: World, regionId: string, at: { col: number; row: number }): void {
  if (regionId !== w.region) {
    w.elsewhere[w.region] = [...w.visited];
    w.visited = new Set(w.elsewhere[regionId] ?? []);
    w.elsewhere = Object.fromEntries(Object.entries(w.elsewhere).filter(([r]) => r !== regionId));
    w.region = regionId;
  }
  w.position = { col: at.col, row: at.row };
  w.destination = null;
  w.visited.add(hexKey(w.position));
}

/** Takes the road off this region's map at the exit the party stands on. */
export function crossOver(w: World, data: GameData): TownResult {
  const exit = regionMap(data, w.region).exitAt(w.position);
  if (!exit) return no('No road leaves the map here.');
  if (w.encounter) return no('Settle the encounter first.');
  if (w.coach) return no('The party is on a coach.');
  enterRegion(w, exit.to.region, exit.to);
  note(w, `The party takes the road: ${exit.name}.`);
  endQuarter(w, data);
  return { ok: true };
}
