// Sieges as the party hears of them (Phase 23a; docs/rules-adaptation.md, Sieges): a line for each
// siege under way, the camps on the map, and the blockade in the town bar. Pure reads.
import { besiegers } from '../game/factions/siege.ts';
import { factionOf, locationName } from '../game/factions/state.ts';
import type { GameData } from '../game/character/context.ts';
import { besieged, settlementOf } from '../game/world/siege-state.ts';
import type { World } from '../game/world/types.ts';
import type { Hex } from '../rules/hex.ts';

/** One line per siege: who besieges whom, the next assault, and whether the party has fought. */
export function siegeLines(w: World, data: GameData): string[] {
  return w.sieges.map((s) => {
    const camps = besiegers(w, data, s).length;
    const fought = s.joined ? ' The party has fought in it.' : '';
    return `${factionOf(data, s.attacker).name} besieges ${locationName(data, s.town)}, held by ${factionOf(data, s.defender).name}, with ${camps} camp${camps === 1 ? '' : 's'}: the next assault comes at the end of day ${Math.max(s.next, w.day) + 1}.${fought}`;
  });
}

/** The besiegers' camps on the party's map, named for the map's tooltips. */
export function campMarkers(w: World, data: GameData): (Hex & { name: string })[] {
  return w.sieges
    .filter((s) => settlementOf(data, s.town)?.region === w.region)
    .flatMap((s) =>
      s.camps.map((c) => ({
        col: c.col,
        row: c.row,
        name: `${factionOf(data, s.attacker).name}'s camp before ${locationName(data, s.town)}`,
      })),
    );
}

/** The blockade, for the town bar. */
export const blockadeText = (w: World, town: string): string | null =>
  besieged(w, town) ? 'Besieged: no coaches, no new stock, prices up' : null;
