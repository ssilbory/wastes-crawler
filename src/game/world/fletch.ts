// Fletching (docs/rules-adaptation.md, Ammo; Sam's calls): a camp quarter's work that makes one
// quiver of the ammo the party's weapons shoot, from nights' firewood and part of a metal component
// (salvage.ts). Anyone with Shoot (vendor/wwn-srd/1.0 Character Creation/1.2.0 Skills.md: Shoot
// covers fletching arrows), Craft, or the Artisan focus can, with crafting tools or at a town's
// workshop.
import type { GameData } from '../character/context.ts';
import { ammoFor, ammoName } from '../character/ammo.ts';
import { putLine } from '../character/stacks.ts';
import { canCraft, hasTools } from './crafting.ts';
import { burnFirewood, firewoodCount } from './firewood.ts';
import { alive, note } from './members.ts';
import { scrapOn, spendScrap } from './salvage.ts';
import { inventoryProblem } from './shop.ts';
import { currentTown } from './town-prices.ts';
import type { Member, World } from './types.ts';

type Cost = { firewood: number; metal: number };

export const canFletch = (m: Member) => Object.hasOwn(m.character.skills, 'shoot') || canCraft(m);

/** The ammo a fletcher makes: their own weapon's first, then the rest of the party's. */
export function fletchFor(w: World, data: GameData, m: Member): string | null {
  const shooters = [m, ...alive(w).filter((x) => x !== m)];
  for (const x of shooters)
    for (const e of x.character.inventory) {
      const ammo = ammoFor(data, e.id);
      if (ammo) return ammo;
    }
  return null;
}

/** A quarter's fletching: one quiver, or a note of what was missing. */
export function fletchShift(w: World, data: GameData, m: Member): void {
  const name = m.character.name;
  if (!canFletch(m)) return note(w, `${name} doesn't know how to fletch.`);
  const town = currentTown(w, data);
  if (!hasTools(data, m) && (!town || town.size === 'village'))
    return note(w, `${name} has no crafting tools to fletch with.`);
  const ammo = fletchFor(w, data, m);
  if (!ammo) return note(w, `No one in the party shoots anything ${name} could fletch.`);
  const what = ammoName(data, ammo);
  const cost = (data.content.equipmentRules.ammo[ammo] as { fletch: Cost }).fletch;
  if (firewoodCount(w, data) < cost.firewood || scrapOn(w, data, 'metal') < cost.metal) {
    const wood = cost.firewood > 0 ? `${cost.firewood} night's firewood and ` : '';
    return note(w, `${name} can't fletch ${what}: it takes ${wood}${cost.metal} metal.`);
  }
  const quiver = { id: ammo, quantity: 1, location: 'stowed' as const };
  const problem = inventoryProblem(data, m, putLine(m.character.inventory, quiver));
  if (problem) return note(w, `${name} fletches nothing: ${problem}.`);
  for (let i = 0; i < cost.firewood; i++) burnFirewood(w, data);
  spendScrap(w, data, 'metal', cost.metal);
  // Burning the firewood may have lightened the fletcher's own pack first.
  m.character = { ...m.character, inventory: putLine(m.character.inventory, quiver) };
  note(w, `${name} fletches a quiver of ${what}.`);
}
