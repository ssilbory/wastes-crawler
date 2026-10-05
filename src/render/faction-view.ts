// What the party hears of the Dark Lands' factions (Phase 13), as text: each faction's standing, its
// goal, and where its bases and assets are. Pure.
import type { FactionState } from '../data/schemas/index.ts';
import type { GameData } from '../game/character/context.ts';
import { GOAL_NAMES } from '../game/factions/goals.ts';
import {
  assetName,
  factionOf,
  locationName,
  locationOf,
  srdAsset,
} from '../game/factions/state.ts';
import { factionMaxHp } from '../rules/factions.ts';
import type { World } from '../game/world/types.ts';

export interface FactionView {
  id: string;
  name: string;
  text: string;
  standing: string;
  goal: string | null;
  places: { name: string; holdings: string[] }[];
}

function goalText(data: GameData, s: FactionState): string | null {
  if (!s.goal) return null;
  const target = s.goal.target;
  const at = target
    ? ` (${factionOf(data, target.faction).name} at ${locationName(data, target.at)})`
    : '';
  return `Goal: ${GOAL_NAMES[s.goal.kind]}${at}`;
}

function places(data: GameData, id: string, s: FactionState): FactionView['places'] {
  const byPlace = new Map<string, string[]>();
  const add = (at: string, line: string) => byPlace.set(at, [...(byPlace.get(at) ?? []), line]);
  for (const b of s.bases) add(b.at, `Base of Influence (${b.hp} of ${b.max})`);
  for (const a of s.assets)
    add(a.at, `${assetName(data, id, a.asset)} (${a.hp} of ${srdAsset(data, a.asset).hp})`);
  return [...byPlace].map(([at, holdings]) => ({ name: locationName(data, at), holdings }));
}

/** Every faction of the region the party is in, in content order. */
export function factionViews(w: World, data: GameData): FactionView[] {
  return data.content.factions.factions.flatMap((f) => {
    const s = w.factions[f.id];
    if (!s || locationOf(data, f.hq).region !== w.region) return [];
    const standing =
      s.hp > 0
        ? `Force ${s.force}, Cunning ${s.cunning}, Wealth ${s.wealth}; ${s.hp} of ${factionMaxHp(s)} hit points, ${s.treasure} Treasure`
        : 'Collapsed';
    return [
      {
        id: f.id,
        name: f.name,
        text: f.text,
        standing,
        goal: s.hp > 0 ? goalText(data, s) : null,
        places: places(data, f.id, s),
      },
    ];
  });
}
