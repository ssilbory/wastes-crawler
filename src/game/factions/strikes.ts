// What a faction's strike changes beyond the two factions (Phase 13b; Sam's call: faction results
// change the world): the attacker's goal progress, the warlord's clock when its faction drives a
// rival out of a location, and a settlement sacked when the blow lands on the faction that holds
// it, raising its prices for a month as a raid does (docs/rules-adaptation.md, Raids).
import type { FactionState } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { moveClock } from '../world/clock.ts';
import { note } from '../world/members.ts';
import type { World } from '../world/types.ts';
import type { OnStrike } from './actions.ts';
import { factionOf, locationName } from './state.ts';

/** Raises a settlement's prices for a month, if `at` is a settlement on any map. */
export function sack(w: World, data: GameData, at: string): void {
  const site = data.content.regions.flatMap((r) => r.sites).find((s) => s.id === at);
  if (!site) return;
  w.raided[at] = w.day + 1 + data.content.overlandRules.daysPerMonth;
  note(w, `${site.name} is sacked. Prices there are up for a month.`);
}

/** The strike hook for faction `id`'s attacks. */
export function strikesFor(w: World, data: GameData, id: string): OnStrike {
  const s = w.factions[id] as FactionState;
  return (victim, at, r) => {
    const goal = s.goal as NonNullable<FactionState['goal']>;
    if (goal.kind === 'blood-the-enemy') goal.progress += r.dealt;
    if (r.razed && goal.target?.faction === victim && goal.target.at === at) goal.progress = 1;
    if (r.razed && id === data.content.campaign.clock.faction)
      moveClock(w, data, 1, `${factionOf(data, id).name} takes ${locationName(data, at)}.`);
    const holds = (w.factions[victim] as FactionState).bases.some((b) => b.at === at);
    if (r.hit && (r.razed || holds)) sack(w, data, at);
  };
}
