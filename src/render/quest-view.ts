// Text and map marks for quests. Pure reads of game state.
import type { Dungeon, Quest } from '../data/schemas/index.ts';
import type { GameData } from '../game/character/context.ts';
import { captiveOf } from '../game/world/npcs.ts';
import { entrancesIn } from '../game/dungeon/ruins.ts';
import { currentStep, payerPlace, payerTown, questOf } from '../game/world/quests.ts';
import { regionMap } from '../game/world/region.ts';
import type { World } from '../game/world/types.ts';
import type { Hex } from '../rules/hex.ts';

/**
 * The home towns of freed captives travelling with the party, on its map (Sam's call,
 * docs/rules-adaptation.md, NPCs): revealed through the fog, so the party knows where to take them.
 */
export function captiveHomes(w: World, data: GameData): Hex[] {
  const sites = regionMap(data, w.region).sites;
  return w.npcs.flatMap((n) => {
    if (n.kind !== 'captive') return [];
    const home = sites.find((s) => s.id === captiveOf(data, n.type).destination);
    return home ? [{ col: home.col, row: home.row }] : [];
  });
}

/** A town's name from its id, in any region, so a captive's home far off still reads by name. */
export const townName = (data: GameData, id: string): string =>
  data.content.regions.flatMap((r) => r.sites).find((s) => s.id === id)?.name ?? id;

/**
 * Hexes on the party's map where an active quest's current step waits, or where a finished one is
 * paid for.
 */
export function questTargets(w: World, data: GameData): Hex[] {
  return Object.entries(w.quests).flatMap(([id, st]) => {
    if (st.status === 'ready') {
      const town = payerTown(data, questOf(data, id));
      return town.region === w.region ? [{ col: town.col, row: town.row }] : [];
    }
    if (st.status !== 'active') return [];
    const o = currentStep(w, data, id);
    if (!o) return [];
    if (o.kind === 'slay' || o.kind === 'scout') return o.region === w.region ? [o.hex] : [];
    if (o.kind === 'escort' || o.kind === 'deliver') {
      const town = regionMap(data, w.region).sites.find((s) => s.id === o.to);
      return town ? [{ col: town.col, row: town.row }] : [];
    }
    // A delve step marks its dungeon's entrance; content checks guarantee the dungeon.
    const d = data.content.dungeons.find((x) => x.id === o.dungeon) as Dungeon;
    return d.region === w.region ? [d.entrance] : [];
  });
}

/**
 * Hexes the party knows of without having seen them, drawn as if it had travelled there (Sam's
 * call): where its quests wait or pay, freed captives' homes, and ways down a rumor told of.
 */
export function revealedHexes(w: World, data: GameData): Hex[] {
  const heard = entrancesIn(data, w.region, w.rumors).filter((e) => e.heard);
  return [
    ...questTargets(w, data),
    ...captiveHomes(w, data),
    ...heard.map((e) => ({ col: e.col, row: e.row })),
  ];
}

/** "60 crowns, 3 XP, 2d6 loot", or a raising quest's free raising. */
export function rewardText(q: Quest): string {
  if (q.reward.raise) return 'one dead PC raised';
  const loot = q.reward.loot.map((d) => `${d.count}d${d.sides}`).join(' + ');
  return [`${q.reward.crowns} crowns`, `${q.reward.xp} XP`, loot && `${loot} loot`]
    .filter(Boolean)
    .join(', ');
}

/** Where a taken quest stands: its current step, or what's left to do. */
export function questStatus(w: World, data: GameData, id: string): string {
  const st = w.quests[id];
  if (!st) return 'Not taken.';
  const q = questOf(data, id);
  if (st.status === 'done') return 'Done.';
  if (st.status === 'failed') return 'Failed.';
  if (st.status === 'ready') return `Done: return to ${payerPlace(data, q)} for the reward.`;
  const left =
    q.deadlineDays === undefined ? '' : ` ${q.deadlineDays - (w.day - st.acceptedDay)} days left.`;
  return `${currentStep(w, data, id)?.text ?? ''}${left}`;
}
