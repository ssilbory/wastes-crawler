// A night's firewood against the cold (vendor/wwn-srd/2.0 The Rules of the Game/2.12.0 Wilderness
// Exploration and Expeditions.md, 2.12.4: a harsh night costs strain only without shelter or fire;
// 2.12.5: a forage find can be a night's firewood instead; docs/rules-adaptation.md, Cold).
import { isHarshNight } from '../../rules/overland.ts';
import type { GameData } from '../character/context.ts';
import { dateOf } from './calendar.ts';
import { addOne, carriers, takeOne } from './loads.ts';
import { alive, bestAt, memberCheck, note } from './members.ts';
import { load } from './mounts.ts';
import { regionMap } from './region.ts';
import { inventoryProblem } from './shop.ts';
import type { Member, World } from './types.ts';

export const FIREWOOD = 'firewood-one-nights-fire';

/** Whether a night here, without shelter, would be harsh; underground there is no weather. */
export function harshHere(w: World, data: GameData): boolean {
  const { season } = dateOf(data.content.overlandRules, w.day);
  return !w.dungeon && isHarshNight(regionMap(data, w.region).terrainAt(w.position).harsh, season);
}

/** Whether anyone in the party, or a porter or pack beast, carries firewood. */
export const carriesFirewood = (w: World, data: GameData): boolean =>
  [...alive(w).map((m) => m.character), ...carriers(w, data).map((c) => c.holder)].some((h) =>
    h.inventory.some((e) => e.id === FIREWOOD),
  );

/** Burns one night's firewood, from a member first, then a porter or pack beast; the burner's name. */
export function burnFirewood(w: World, data: GameData): string | null {
  for (const m of alive(w)) {
    const i = m.character.inventory.findIndex((e) => e.id === FIREWOOD);
    if (i < 0) continue;
    m.character = { ...m.character, inventory: takeOne(m.character.inventory, i) };
    return m.character.name;
  }
  for (const c of carriers(w, data)) {
    const i = c.holder.inventory.findIndex((e) => e.id === FIREWOOD);
    if (i < 0) continue;
    c.holder.inventory = takeOne(c.holder.inventory, i);
    return c.holder.name;
  }
  return null;
}

/**
 * Gather Firewood: the best of the gatherers makes a Wis/Survive check at the terrain's forage
 * difficulty, and a success yields one night's firewood, carried by the finder or else by a porter or
 * pack beast with room. Returns whether anyone went looking.
 */
export function gatherFirewood(
  w: World,
  data: GameData,
  gatherers: readonly Member[],
  difficulty: number,
): boolean {
  const best = bestAt(data, gatherers, 'survive', ['wis']);
  if (!best) return false;
  const name = best.character.name;
  if (!memberCheck(w, data, best, 'survive', ['wis'], difficulty).success) {
    note(w, `${name} finds nothing to burn.`);
    return true;
  }
  const wood = { id: FIREWOOD, quantity: 1, location: 'stowed' as const };
  const carried = addOne(best.character.inventory, wood);
  if (!inventoryProblem(data, best, carried)) {
    best.character = { ...best.character, inventory: carried };
    note(w, `${name} gathers a night's firewood.`);
    return true;
  }
  const beast = carriers(w, data).find(
    (c) => load(data, { inventory: addOne(c.holder.inventory, wood) }) <= c.capacity,
  );
  if (beast) {
    beast.holder.inventory = addOne(beast.holder.inventory, wood);
    note(w, `${name} gathers a night's firewood for ${beast.holder.name} to carry.`);
  } else note(w, `${name} gathers firewood, but no one has room to carry it.`);
  return true;
}
