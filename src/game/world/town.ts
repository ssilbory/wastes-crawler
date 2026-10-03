// Stand-in towns (docs/plan.md, Phase 5): entering one gives a full rest (docs/rules-adaptation.md,
// Rest economy), restocks the rations die, and raises the dead until Phase 6's temples.
import { RESOURCE_DICE } from '../../rules/resource-die.ts';
import type { GameData } from '../character/context.ts';
import { note, restoreMember } from './members.ts';
import { regionMap } from './region.ts';
import type { World } from './types.ts';

export const FULL_RATIONS = RESOURCE_DICE[RESOURCE_DICE.length - 1] as 12;

export function enterTown(w: World, data: GameData, siteId: string): void {
  const site = regionMap(data, w.region).sites.find((s) => s.id === siteId);
  if (!site) throw new Error(`unknown town ${siteId}`);
  const raised = w.members.filter((m) => m.dead).map((m) => m.character.name);
  for (const m of w.members) restoreMember(m);
  w.rations = FULL_RATIONS;
  w.lastTown = site.id;
  w.camp = 'made';
  note(w, `The party rests in ${site.name}: wounds healed and supplies restocked.`);
  if (raised.length > 0) note(w, `The temple raises ${raised.join(' and ')}.`);
}

/** The party falls: everyone wakes in the last town visited the next morning. */
export function wipe(w: World, data: GameData): void {
  const town = regionMap(data, w.region).sites.find((s) => s.id === w.lastTown);
  if (!town) throw new Error(`unknown town ${w.lastTown}`);
  note(w, 'The party falls.');
  w.position = { col: town.col, row: town.row };
  w.destination = null;
  w.encounter = null;
  w.day += 1;
  w.quarter = 0;
  w.hikes = 0;
  w.noRecovery = false;
  for (const m of w.members) m.slept = false;
  enterTown(w, data, town.id);
}
