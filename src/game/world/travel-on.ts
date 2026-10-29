// Travel on (Sam's call; docs/rules-adaptation.md, Overland travel: Travel on): the suggested plan,
// played quarter after quarter toward the destination (hiking by day, camping by night, plans.ts),
// until the party arrives or something needs the player: an encounter, a member hurt, strained,
// or slain, a quest changing, the rations or water running out, or a week on the road.
import { hexKey } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { suggestPlan } from './plans.ts';
import { passQuarter } from './quarter.ts';
import type { World } from './types.ts';

/** Quarters played at most before the party pauses: a week. */
export const TRAVEL_LIMIT = 28;

/** What the party looks like now, to tell what a quarter changed. */
export function snapshot(w: World) {
  return {
    // Each member is kept by reference: a quarter changes them in place.
    members: w.members.map((m) => ({
      m,
      dead: m.dead,
      hp: m.character.hp.current,
      strain: m.character.strain.value,
    })),
    quests: Object.entries(w.quests)
      .map(([id, q]) => `${id}:${q.status}:${q.step}`)
      .join(),
    rations: w.rations,
    water: w.water,
  };
}

/** Why travel stops after a quarter, or null to go on. */
export function stopAfter(
  w: World,
  before: ReturnType<typeof snapshot>,
  target: string,
): string | null {
  if (w.encounter) return 'Something on the road stops the party.';
  for (const { m, dead, hp, strain } of before.members) {
    const name = m.character.name;
    if (m.dead && !dead) return `${name} has died.`;
    if (m.character.hp.current < hp) return `${name} is hurt.`;
    if (m.character.strain.value > strain) return `${name} takes System Strain.`;
  }
  const now = snapshot(w);
  if (now.quests !== before.quests) return 'A quest has changed.';
  if (now.rations === 0 && before.rations > 0) return 'The rations are gone.';
  if (now.water === 0 && before.water > 0) return 'The water is gone.';
  if (w.dungeon || w.coach || w.realmEnd === 'reached') return 'The journey takes a turn.';
  if (!w.destination)
    return hexKey(w.position) === target ? 'The party arrives.' : 'The party can get no closer.';
  return null;
}

/**
 * Plays quarters toward the destination until the party arrives or must stop. Returns how many
 * quarters passed and why it stopped.
 */
export function travelOn(
  w: World,
  data: GameData,
  limit = TRAVEL_LIMIT,
): { quarters: number; stop: string } {
  if (!w.destination) return { quarters: 0, stop: 'Pick a hex to travel to first.' };
  const target = hexKey(w.destination);
  for (let quarters = 0; quarters < limit;) {
    const before = snapshot(w);
    if (!passQuarter(w, data, suggestPlan(w, data))) {
      return { quarters, stop: "The party can't travel on now." };
    }
    quarters += 1;
    const stop = stopAfter(w, before, target);
    if (stop) return { quarters, stop };
  }
  return { quarters: limit, stop: 'A week on the road: the party pauses.' };
}
