// Quests to free a held settlement (Phase 23e; docs/rules-adaptation.md, Sieges: Freeing quests;
// Sam's calls). While one of the ally's settlements is held against it, every mission giver in
// the ally's free settlements offers a quest to free it, one step long, paid by whoever offered it
// and scaled to the settlement's size (data/content/siege-rules.json, freeQuest). The quest is done
// when the settlement is freed with the party's part in it (src/game/factions/capture.ts, reclaim),
// and fails when it is freed without; changing hands between rivals leaves it standing. The game
// builds these quests from their ids, `free-<town>-by-<giver>`, so they live in no content file.
import type { Quest } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { allyOf, allyTowns, holderOf, settlementOf } from './siege-state.ts';
import type { World } from './types.ts';

const PREFIX = 'free-';
const BY = '-by-';

/** The id of the quest to free a town, offered by a giver. */
export const freeQuestId = (town: string, giver: string) => `${PREFIX}${town}${BY}${giver}`;

/** The town and giver a freeing quest's id names, or null for any other id. */
export function parseFreeId(data: GameData, id: string): { town: string; giver: string } | null {
  const town = allyTowns(data).find((t) => id.startsWith(`${PREFIX}${t}${BY}`));
  const giver = town && id.slice(`${PREFIX}${town}${BY}`.length);
  const real = data.content.missionGivers.some((g) => g.id === giver);
  return town && giver && real ? { town, giver } : null;
}

/** The quest a freeing id names, built from the content's template; null for any other id. */
export function freeQuest(data: GameData, id: string): Quest | null {
  const parsed = parseFreeId(data, id);
  if (!parsed) return null;
  const t = data.content.siegeRules.freeQuest;
  // Ally towns are settlements (siege-state.ts, allyTowns).
  const site = settlementOf(data, parsed.town)?.site as { name: string; size: 'village' };
  const fill = (text: string) => text.replaceAll('{town}', site.name);
  const pay = t.reward[site.size];
  return {
    id,
    name: fill(t.name),
    giver: parsed.giver,
    summary: fill(t.summary),
    prerequisites: { quests: [], minLevel: 1 },
    objectives: [{ kind: 'free', town: parsed.town, text: fill(t.text) }],
    reward: { crowns: pay.crowns, xp: pay.xp, loot: [] },
  };
}

/** Whether a giver stands in one of the ally's settlements that the ally still holds. */
function freeGiver(w: World, data: GameData, giver: string): boolean {
  const town = data.content.missionGivers.find((g) => g.id === giver)?.town;
  const id = town === undefined ? null : allyOf(data, town);
  const ally = id === null ? undefined : w.factions[id];
  return ally?.bases.some((b) => b.at === town) === true;
}

/** A freeing quest for this town under way, from any giver. */
const underWay = (w: World, town: string) =>
  Object.entries(w.quests).some(
    ([id, st]) =>
      id.startsWith(`${PREFIX}${town}${BY}`) && (st.status === 'active' || st.status === 'ready'),
  );

/**
 * The freeing quests a giver offers: one for each held settlement of the ally's, while the giver
 * stands in a free one and no freeing quest for that settlement is under way. Its own, under way,
 * stays on its board until it is paid.
 */
export function freeQuestsFrom(w: World, data: GameData, giver: string): Quest[] {
  return allyTowns(data).flatMap((town) => {
    const id = freeQuestId(town, giver);
    const st = w.quests[id]?.status;
    const mine = st === 'active' || st === 'ready';
    const offered = freeGiver(w, data, giver) && holderOf(w, data, town) && !underWay(w, town);
    return mine || offered ? [freeQuest(data, id) as Quest] : [];
  });
}

/** Whether a quest is a freeing quest, which can be taken again each time its town is held. */
export const isFreeing = (q: Quest) => q.objectives[0]?.kind === 'free';
