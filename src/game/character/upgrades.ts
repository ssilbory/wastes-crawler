// What crafting and magic do to one weapon or suit of armor on the sheet (vendor/wwn-srd/2.0 The
// Rules of the Game/2.8.0 Crafting and Modifying Gear.md): mastercrafted weapons +1 to hit (2.8.1),
// working mods (2.8.4), a magic weapon's bonus to hit, damage, and Shock and magic armor's to its
// AC (4.0 Magic and Spellcasting/4.9.0, 4.9.3), no bonus above +3 (2.8.4), and an item left
// unmaintained too long working badly (2.8.3, with Sam's penalty in place of "stops working").
import { flawsOf } from './abilities.ts';
import type { GameData } from './context.ts';
import type { InventoryEntry } from './items.ts';

/** SRD 2.8.4: mods can't raise a hit, AC, or damage bonus above +3. */
export const BONUS_CAP = 3;

export interface Upgrade {
  hit: number;
  damage: number;
  ac: number;
  /** Change to each unit's encumbrance. */
  encumbrance: number;
  /** Unmaintained past the limit: the item works badly. */
  broken: boolean;
}

/** True once the item's own upkeep has lapsed: a week for mods, a day for jury-rigged gear. */
export function brokenEntry(data: GameData, entry: InventoryEntry): boolean {
  const days = entry.upkeep ?? 0;
  if (entry.quality === 'jury-rigged') return days >= 1;
  return days >= data.content.craftingRules.upkeep.brokenAfterDays;
}

export function upgrade(data: GameData, entry: InventoryEntry): Upgrade {
  // SRD 2.8.3: a mod a day without maintenance stops working. The creator's first mod needs none (2.8.1).
  const working = (entry.mods ?? []).filter((m) => m.free || !entry.upkeep);
  const mods = working.flatMap((m) => {
    const mod = data.content.mods.find((x) => x.id === m.id);
    return mod ? [mod] : [];
  });
  const sum = (f: (m: (typeof mods)[number]) => number | undefined) =>
    mods.reduce((n, m) => n + (f(m) ?? 0), 0);
  const broken = brokenEntry(data, entry);
  const penalty = broken ? data.content.craftingRules.upkeep.penalty : 0;
  const master = entry.quality === 'mastercrafted' ? 1 : 0;
  const magic = entry.bonus ?? 0;
  // A forging's flaws count against the item after the cap (SRD 4.10.0).
  const flaws = flawsOf(data, entry);
  const flawed = (f: (x: (typeof flaws)[number]) => number | undefined) =>
    flaws.reduce((n, x) => n + (f(x) ?? 0), 0);
  return {
    hit:
      Math.min(BONUS_CAP, master + magic + sum((m) => m.weapon?.hit)) -
      penalty +
      flawed((f) => f.weapon?.hit),
    damage:
      Math.min(BONUS_CAP, magic + sum((m) => m.weapon?.damage)) + flawed((f) => f.weapon?.damage),
    // Only armor reads the AC, and only weapons the hit and damage, so one bonus serves both.
    ac: Math.min(BONUS_CAP, magic + sum((m) => m.armor?.ac)) - penalty + flawed((f) => f.armor?.ac),
    // Each mod fits only its own kind of item, so a weapon's and armor's changes never mix.
    encumbrance:
      sum((m) => (m.armor?.encumbrance ?? 0) + (m.weapon?.encumbrance ?? 0)) +
      flawed((f) => f.armor?.encumbrance),
    broken,
  };
}
