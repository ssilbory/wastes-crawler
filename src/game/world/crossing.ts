// Travel between regions (docs/rules-adaptation.md, Regions in Phase 12; Sam's call: new worlds
// start in the Borderlands, and a road leads on into the Dark Lands, both ways). Each region keeps
// its own explored hexes; taking the road is a quarter day.
import type { GameData } from '../character/context.ts';
import { enterRegion } from './enter-region.ts';
import { note } from './members.ts';
import { regionMap } from './region.ts';
import type { TownResult } from './services.ts';
import type { World } from './types.ts';
import { endQuarter } from './end-quarter.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

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
