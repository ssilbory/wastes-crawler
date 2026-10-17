// The Wastes' warlords as the party knows them (docs/rules-adaptation.md, The Wastes: Warlords):
// who rules each map, where they hold out, and who has fallen. Pure reads of game state.
import type { Dungeon, Region } from '../data/schemas/index.ts';
import type { GameData } from '../game/character/context.ts';
import type { World } from '../game/world/types.ts';

export interface WarlordView {
  id: string;
  name: string;
  /** The map they rule, and the stronghold they hold. */
  map: string;
  stronghold: string;
  fallen: boolean;
}

/** The warlords of the party's realm, in ladder order; none outside a realm that has them. */
export function warlordViews(w: World, data: GameData): WarlordView[] {
  const realm = data.content.realms.find((r) => r.id === w.realm);
  if (!realm) return [];
  // Content checks give each warlord a known map and exactly one hoard (warlord-check.ts).
  return data.content.warlords.warlords
    .filter((l) => realm.regions.includes(l.region))
    .map((l) => ({
      id: l.id,
      name: l.name,
      map: (data.content.regions.find((r) => r.id === l.region) as Region).name,
      stronghold: (
        data.content.dungeons.find((d) =>
          d.levels.some((v) => v.specials.some((s) => s.kind === 'cache' && s.warlord === l.id)),
        ) as Dungeon
      ).name,
      fallen: w.warlords.includes(l.id),
    }));
}
