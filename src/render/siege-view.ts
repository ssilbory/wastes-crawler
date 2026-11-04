// Sieges as the party hears of them (Phase 23a; docs/rules-adaptation.md, Sieges): a line for each
// siege under way, the camps on the map, and the blockade in the town bar. Pure reads.
import { besiegers } from '../game/factions/siege.ts';
import { factionOf, locationName } from '../game/factions/state.ts';
import type { GameData } from '../game/character/context.ts';
import { allyTowns, besieged, holderOf, settlementOf } from '../game/world/siege-state.ts';
import { stormTarget } from '../game/world/storm.ts';
import type { World } from '../game/world/types.ts';
import type { Hex } from '../rules/hex.ts';

/** One line per held settlement, then per siege: who besieges whom, the next assault, and more. */
export function siegeLines(w: World, data: GameData): string[] {
  const held = allyTowns(data).flatMap((town) => {
    const holder = holderOf(w, data, town);
    return holder
      ? [`${locationName(data, town)} is held by ${factionOf(data, holder).name}.`]
      : [];
  });
  return [
    ...held,
    ...w.sieges.map((s) => {
      const camps = besiegers(w, data, s).length;
      const fought = s.joined ? ' The party has fought in it.' : '';
      return `${factionOf(data, s.attacker).name} besieges ${locationName(data, s.town)}, held by ${factionOf(data, s.defender).name}, with ${camps} camp${camps === 1 ? '' : 's'}: the next assault comes at the end of day ${Math.max(s.next, w.day) + 1}.${fought}`;
    }),
  ];
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

/** A held settlement's state, for the town bar (A held settlement, Phase 23b). */
export function heldText(w: World, data: GameData, town: string): string | null {
  const holder = holderOf(w, data, town);
  return holder
    ? `Held by ${factionOf(data, holder).name}: shop and inn only, at ${data.content.siegeRules.heldPrice} times the price`
    : null;
}

/** What the party would storm in a held settlement it stands in, with the fight's size. */
export function stormView(w: World, data: GameData): { name: string; fighters: number } | null {
  const t = stormTarget(w, data);
  return t ? { name: t.name, fighters: t.rows.flat().length } : null;
}
