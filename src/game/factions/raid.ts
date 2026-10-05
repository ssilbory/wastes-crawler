// Raids as faction attacks (Phase 13b; docs/rules-adaptation.md, Raids). When the raiding
// faction's Attack would fall on a settlement of the raided region, and no raid is pending, the
// settlement gets a week's warning instead, and the attack comes on the raid's day. A party there
// meets the leading asset's patrol at the gates; beating it destroys that asset. Otherwise the
// faction's assets in the settlement attack as usual, and a hit sacks it.
import type { GameData } from '../character/context.ts';
import { note } from '../world/members.ts';
import type { World } from '../world/types.ts';
import { readyAttackers, victimAt } from './actions.ts';
import { hurtAsset, strike } from './combat.ts';
import { patrolOf } from './patrols.ts';
import { factionOf, isActive, locationName, news } from './state.ts';
import { strikesFor } from './strikes.ts';

const rules = (data: GameData) => data.content.raidRules;

const isRaidable = (data: GameData, at: string) =>
  data.content.regions.some((r) => r.id === rules(data).region && r.sites.some((s) => s.id === at));

/**
 * The raiding faction's attack on a settlement becomes a raid with warning; returns the town, so
 * its assets there hold back until the raid's day, or null.
 */
export function warnRaid(w: World, data: GameData, id: string): string | null {
  if (id !== rules(data).faction || w.raid) return null;
  const leader = readyAttackers(w, data, id).find((a) => isRaidable(data, a.at));
  if (!leader) return null;
  w.raid = {
    town: leader.at,
    day: w.day + 1 + rules(data).warningDays,
    fighting: false,
    asset: leader.uid,
  };
  note(
    w,
    `Word comes that ${factionOf(data, id).name} will strike ${locationName(data, leader.at)} within ${rules(data).warningDays} days.`,
  );
  return leader.at;
}

const leaderOf = (w: World, data: GameData) =>
  w.factions[rules(data).faction]?.assets.find((a) => a.uid === w.raid?.asset);

/** The group at the gates: the leading asset's patrol, or the content's raiders without one. */
export function raidParty(w: World, data: GameData): string[][] {
  const leader = leaderOf(w, data);
  const patrol = leader && patrolOf(data, rules(data).faction, leader.asset);
  return patrol ? patrol.enemies : rules(data).raiders;
}

/** The raid's day: the faction's assets in the settlement attack. Returns whether any hit. */
export function resolveRaid(w: World, data: GameData, town: string): boolean {
  const id = rules(data).faction;
  if (!isActive(w.factions[id])) return false;
  const onStrike = strikesFor(w, data, id);
  let hit = false;
  for (const held of readyAttackers(w, data, id).filter((a) => a.at === town)) {
    // An earlier strike may have razed or destroyed everything here.
    const victim = victimAt(w, data, id, town);
    if (!victim) continue;
    const r = strike(w, data, id, held, victim, new Set());
    onStrike(victim, town, r);
    hit ||= r.hit;
  }
  return hit;
}

/** The party beat the raiders at the gates: the leading asset is destroyed. */
export function routRaid(w: World, data: GameData): void {
  const leader = leaderOf(w, data);
  if (!leader) return;
  news(w, `the raiders were routed at ${locationName(data, (w.raid as { town: string }).town)}.`);
  hurtAsset(w, data, rules(data).faction, leader, leader.hp);
}
