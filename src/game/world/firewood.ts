// A night's firewood (vendor/wwn-srd/2.0 The Rules of the Game/2.12.0 Wilderness Exploration and
// Expeditions.md; docs/rules-adaptation.md, Cold). 2.12.4: a harsh night costs strain only without
// shelter or fire, and a fire also lets the party rest (Sam's call). 2.12.5: a forage find can be
// firewood instead; here a find is one night's. A find also cuts fresh torches for the party's
// Dungeoneering Kits (Sam's call, docs/rules-adaptation.md, Dungeon exploration).
import { isHarshNight } from '../../rules/overland.ts';
import type { GameData } from '../character/context.ts';
import { immuneTo } from './arts.ts';
import { dateOf } from './calendar.ts';
import { restockKits } from '../dungeon/light.ts';
import { addOne, carriers, takeOne } from './loads.ts';
import { alive, bestAt, memberCheck, note } from './members.ts';
import { load } from './mounts.ts';
import { firstPhysician } from './npcs.ts';
import { regionMap } from './region.ts';
import { inventoryProblem } from './shop.ts';
import type { Member, World } from './types.ts';

export const FIREWOOD = 'firewood-one-nights-fire';

/** Whether a night here, without shelter, would be harsh; underground there is no weather. */
export function harshHere(w: World, data: GameData): boolean {
  const { season } = dateOf(data.content.overlandRules, w.day);
  return !w.dungeon && isHarshNight(regionMap(data, w.region).terrainAt(w.position).harsh, season);
}

/**
 * Whether a member would feel a harsh night's cold: not sleeping off a revival, not tended by a
 * physician (Sam's call), and without an art that keeps it off.
 */
export const exposedToCold = (w: World, data: GameData, m: Member): boolean =>
  !m.reviving && !firstPhysician(w, data) && !immuneTo(data, m, 'cold');

/** Whether anyone in the party, or a porter, pack beast, or mount, carries firewood. */
export const carriesFirewood = (w: World, data: GameData): boolean =>
  [...alive(w).map((m) => m.character), ...carriers(w, data).map((c) => c.holder)].some((h) =>
    h.inventory.some((e) => e.id === FIREWOOD),
  );

/** Burns one night's firewood, from a member first, then a carrier; the burner's name. */
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
 * difficulty, and a success yields one night's firewood, carried by the finder or else by a porter,
 * pack beast, or mount with room, and restocks the kits' torches. Returns whether anyone went
 * looking.
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
  // Treeless land has nothing to burn (Sam's call: Water and fuel); no one wanders off for it.
  if (regionMap(data, w.region).terrainAt(w.position).treeless) {
    note(w, `${name} finds no wood in this treeless land.`);
    return false;
  }
  if (!memberCheck(w, data, best, 'survive', ['wis'], difficulty).success) {
    note(w, `${name} finds nothing to burn.`);
    return true;
  }
  stow(w, data, best);
  if (restockKits(w)) note(w, `${name} cuts fresh torches for the kits.`);
  return true;
}

/** Carries a night's firewood found by `finder`, or a porter, pack beast, or mount with room. */
function stow(w: World, data: GameData, finder: Member): void {
  const name = finder.character.name;
  const wood = { id: FIREWOOD, quantity: 1, location: 'stowed' as const };
  const carried = addOne(finder.character.inventory, wood);
  if (!inventoryProblem(data, finder, carried)) {
    finder.character = { ...finder.character, inventory: carried };
    note(w, `${name} gathers a night's firewood.`);
    return;
  }
  const beast = carriers(w, data).find(
    (c) => load(data, { inventory: addOne(c.holder.inventory, wood) }) <= c.capacity,
  );
  if (beast) {
    beast.holder.inventory = addOne(beast.holder.inventory, wood);
    note(w, `${name} gathers a night's firewood for ${beast.holder.name} to carry.`);
  } else note(w, `${name} gathers firewood, but no one has room to carry it.`);
}
