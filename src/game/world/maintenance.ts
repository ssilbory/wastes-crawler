// Maintaining mods (docs/rules-adaptation.md, Crafting and modifying gear; vendor/wwn-srd/2.0 The
// Rules of the Game/2.8.0 Crafting and Modifying Gear.md, 2.8.3). Each night in town or in a made
// camp, the party's artisans maintain what they can: each one's capacity is their Int and Con
// modifiers plus three times their Craft level, and they only maintain mods they could build.
// Jury-rigged gear counts as a Craft-0 mod (2.8.1). Anything left over goes another day without.
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { findItem, type CatalogItem, type InventoryEntry } from '../character/items.ts';
import { brokenEntry } from '../character/upgrades.ts';
import type { WorldEvent } from './bus.ts';
import { note } from './members.ts';
import { canMod, craftLevel, modOf } from './mods.ts';
import { regionMap } from './region.ts';
import type { Member, World } from './types.ts';

/** How many mods a member can keep up; zero without Craft. */
export function capacity(data: GameData, m: Member): number {
  const level = craftLevel(m);
  if (level === null || m.dead) return 0;
  const { modifiers } = characterSheet(m.character, data);
  return Math.max(0, modifiers.int + modifiers.con + 3 * level);
}

/** What an inventory line needs kept up: the Craft level and the mods that count. */
export function upkeepNeed(
  data: GameData,
  entry: InventoryEntry,
): { level: number; points: number } | null {
  if (entry.quality === 'jury-rigged') return { level: 0, points: 1 };
  const due = (entry.mods ?? []).filter((x) => !x.free);
  if (due.length === 0) return null;
  return { level: Math.max(...due.map((x) => modOf(data, x.id).minCraft)), points: due.length };
}

/** Who, of those with capacity, can maintain at a level: anyone for jury-rigged gear, modders for mods. */
const able = (m: Member, level: number) =>
  (craftLevel(m) as number) >= level && (level === 0 || canMod(m));

/** One day of maintenance for the party's gear. */
export function maintain(w: World, data: GameData): void {
  const sheltered = w.camp === 'made' || regionMap(data, w.region).siteAt(w.position) !== undefined;
  const budget = new Map(
    w.members.flatMap((m) => (sheltered && capacity(data, m) > 0 ? [[m, capacity(data, m)]] : [])),
  );
  for (const owner of w.members) {
    const inventory = owner.character.inventory.map((entry) => {
      const need = upkeepNeed(data, entry);
      if (!need) return entry;
      const artisan = [...budget].find(([m, left]) => left >= need.points && able(m, need.level));
      if (artisan) {
        budget.set(artisan[0], artisan[1] - need.points);
        const kept = { ...entry };
        delete kept.upkeep;
        return kept;
      }
      const next = { ...entry, upkeep: (entry.upkeep ?? 0) + 1 };
      lapse(w, data, owner, entry, next);
      return next;
    });
    owner.character = { ...owner.character, inventory };
  }
}

function lapse(
  w: World,
  data: GameData,
  owner: Member,
  before: InventoryEntry,
  after: InventoryEntry,
): void {
  const item = `${owner.character.name}'s ${(findItem(data, after.id) as CatalogItem).name}`;
  if (!before.upkeep && after.mods?.length) note(w, `${item}: its mods stop working unmaintained.`);
  if (!brokenEntry(data, before) && brokenEntry(data, after))
    note(w, `${item} is breaking down for want of maintenance.`);
}

/** The maintenance bus listener: once a day. */
export function maintenanceListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind === 'day-passed') maintain(w, data);
}
