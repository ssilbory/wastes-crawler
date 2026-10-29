// Salvage (Sam's calls, docs/rules-adaptation.md, Salvage): a crafter breaks plain weapons, armor,
// shields, and iron gear down for parts, at a town's workshop or anywhere with crafting tools (the
// SRD's workshop, vendor/wwn-srd/2.0 The Rules of the Game/2.8.0 Crafting and Modifying Gear.md,
// 2.8.1). Each item yields quarters of a metal, wood, or hide component; the fractions pile up by
// type, and every whole one becomes that type's scrap part in the stash, spent like any component.
import type { ComponentType } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { findItem, type InventoryEntry } from '../character/items.ts';
import { takeLine } from '../character/stacks.ts';
import { componentName } from './components.ts';
import { canCraft, hasTools } from './crafting.ts';
import { check, done } from './inventory.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import { currentTown } from './town-prices.ts';
import type { Member, World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });
const rules = (data: GameData) => data.content.craftingRules.salvage;

export interface SalvageYield {
  type: ComponentType;
  amount: number;
}

/** What one unit of a line yields, or null if it can't be salvaged: unlisted, magic, or modded. */
export function salvageYield(data: GameData, entry: InventoryEntry): SalvageYield | null {
  if (entry.bonus || entry.ability || entry.mods?.length) return null;
  return rules(data).yields[entry.id] ?? null;
}

/** The member who would do the salvaging here, or why no one can. */
export function salvager(w: World, data: GameData): Member | string {
  const crafters = w.members.filter((m) => !m.dead && canCraft(m));
  if (crafters.length === 0) return 'Salvage needs someone with Craft or the Artisan focus.';
  // A town's workshop serves without tools; villages have none.
  const town = w.dungeon ? undefined : currentTown(w, data);
  const workshop = town !== undefined && town.size !== 'village';
  return (
    crafters.find((m) => workshop || hasTools(data, m)) ??
    "Salvage needs crafting tools or a town's workshop."
  );
}

/** Breaks some or all of a line down for parts. */
export function salvageGear(
  w: World,
  data: GameData,
  memberId: string,
  index: number,
  quantity: number,
): TownResult {
  const found = check(w, memberId, index, quantity);
  if (typeof found === 'string') return no(found);
  const { m, entry } = found;
  const name = findItem(data, entry.id)?.name ?? entry.id;
  const y = salvageYield(data, entry);
  if (!y) return no(`${name} can't be salvaged.`);
  if (entry.serial && w.projects.some((p) => p.target === entry.serial))
    return no(`${name} is being worked on.`);
  const who = salvager(w, data);
  if (typeof who === 'string') return no(who);
  const { taken, rest } = takeLine(m.character.inventory, index, quantity);
  m.character = { ...m.character, inventory: rest };
  const gained = y.amount * taken.quantity;
  const total = (w.scrap[y.type] ?? 0) + gained;
  const whole = Math.floor(total);
  const part = rules(data).parts[y.type] as string;
  if (whole > 0) w.components[part] = (w.components[part] ?? 0) + whole;
  const others = Object.entries(w.scrap).filter(([type]) => type !== y.type);
  w.scrap = Object.fromEntries(total > whole ? [...others, [y.type, total - whole]] : others);
  const made = whole > 0 ? `; that makes ${whole} ${componentName(data, part).toLowerCase()}` : '';
  note(
    w,
    `${who.character.name} salvages ${name}${taken.quantity > 1 ? ` × ${taken.quantity}` : ''} for ${gained} ${y.type}${made}.`,
  );
  return done(w, data);
}
