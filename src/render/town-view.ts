// Text for the town screens. Pure reads of game state; nothing here changes it.
import { brokenEntry } from '../game/character/upgrades.ts';
import type { Character, LootDice } from '../data/schemas/index.ts';
import { canLevelUp } from '../game/character/advance.ts';
import type { GameData } from '../game/character/context.ts';
import { characterSheet } from '../game/character/derived.ts';
import { findItem, type InventoryEntry } from '../game/character/items.ts';
import { haggler } from '../game/world/trade.ts';
import { defenseStats } from './gear-view.ts';
import type { World } from '../game/world/types.ts';
import { xpForLevel } from '../rules/advancement.ts';

/** "1 crown", "12.5 crowns". */
export function crowns(n: number): string {
  return `${n} crown${n === 1 ? '' : 's'}`;
}

/** "1d4 + 3d6", or "none". */
export function lootText(loot: readonly LootDice[]): string {
  return loot.length === 0 ? 'none' : loot.map((d) => `${d.count}d${d.sides}`).join(' + ');
}

/** "Level 2 · XP 4.5 of 6", flagged when the next level is ready. */
export function levelLine(data: GameData, c: Character): string {
  const { level } = characterSheet(c, data);
  const ready = canLevelUp(data, c) ? ' · ready to level up' : '';
  return `Level ${level} · XP ${c.xp} of ${xpForLevel(level + 1)}${ready}`;
}

/** "Crowbar ×2 (stowed)", with quality, mods, upkeep, size, and barding notes. */
export function entryText(data: GameData, entry: InventoryEntry): string {
  const item = findItem(data, entry.id);
  const stats = defenseStats(data, item, entry.bonus ?? 0);
  const name = `${item?.name ?? entry.id}${entry.bonus ? ` +${entry.bonus}` : ''}${stats ? ` · ${stats}` : ''}`;
  const mods = (entry.mods ?? []).map((m) => data.content.mods.find((x) => x.id === m.id)?.name);
  const notes = [
    entry.quality,
    ...mods,
    entry.upkeep && (brokenEntry(data, entry) ? 'breaking down' : 'unmaintained'),
    entry.small && 'small',
    entry.barding && 'barding',
    entry.location,
  ].filter(Boolean);
  const qty = entry.quantity > 1 ? ` ×${entry.quantity}` : '';
  return `${name}${qty} (${notes.join(', ')})`;
}

/** Saved skill points, with the Quick Learner share called out. */
export function pointsText(c: Character): string {
  const { skillPoints, quickPoints } = c.advancement;
  const quick = quickPoints > 0 ? ` + ${quickPoints} Quick Learner` : '';
  return `${skillPoints} skill point${skillPoints === 1 ? '' : 's'}${quick}`;
}

/** "Snag haggles: prices 10% lower, gear sells for 10% more", or null with no trader. */
export function tradeText(w: World, data: GameData): string | null {
  const h = haggler(w, data);
  if (!h) return null;
  return `${h.member.character.name} haggles: prices ${h.percent}% lower, gear sells for ${h.percent}% more`;
}
