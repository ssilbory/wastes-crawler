// Ammo (docs/rules-adaptation.md, Resource dice and Ammo; Sam's calls): bows and the crossbow shoot
// arrows and hurlants shoot hurlant bolts, and a weapon with none carried can't shoot.
import type { Character } from '../../data/schemas/index.ts';
import type { GameData } from './context.ts';
import { findItem, type CatalogItem } from './items.ts';

/** The ammo a weapon shoots, or null for one that needs none. */
export function ammoFor(data: GameData, weaponId: string): string | null {
  const found = Object.entries(data.content.equipmentRules.ammo).find(([, a]) =>
    a.weapons.includes(weaponId),
  );
  return found ? found[0] : null;
}

/** "Arrows, 20" as "arrows", for log lines; content checks keep ammo real gear. */
export const ammoName = (data: GameData, id: string) =>
  ((findItem(data, id) as CatalogItem).name.split(',')[0] as string).toLowerCase();

export const carriesAmmo = (c: Character, ammo: string) => c.inventory.some((e) => e.id === ammo);
