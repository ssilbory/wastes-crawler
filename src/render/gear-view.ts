// An item's fighting numbers for the shop list and the inventory (Sam's call): armor's and a shield's
// AC, and a weapon's damage, Shock, attributes, range, and traits (vendor/wwn-srd/3.0 Equipment,
// Armor, and Weapons/3.4.0 Armor.md, 3.5.0 Weapons.md).
import type { WeaponTrait } from '../data/schemas/index.ts';
import type { CatalogItem } from '../game/character/items.ts';
import type { GameData } from '../game/character/context.ts';

const ATTRIBUTES = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };

/** An inventory line's fighting numbers, with a magic bonus; null for gear that has none. */
export const lineStats = (data: GameData, item: CatalogItem | undefined, bonus = 0) =>
  item ? itemStats(data, item, bonus) : null;

/** Armor's and a shield's AC alone, for the town's shorter lines; null for other gear. */
export const defenseStats = (data: GameData, item: CatalogItem | undefined, bonus = 0) =>
  item?.kind === 'armor' || item?.kind === 'shield' ? itemStats(data, item, bonus) : null;

/** "AC 14, medium", "AC 13, or +1 over better armor", "1d8 damage, Shock 2/AC 13, Str/Dex", or null. */
export function itemStats(data: GameData, item: CatalogItem, bonus = 0): string | null {
  if (item.kind === 'armor') return `AC ${item.armor.ac + bonus}, ${item.armor.category}`;
  if (item.kind === 'shield') {
    const s = item.shield;
    const cover = s.cover ? ', cover' : '';
    return `AC ${s.baseAc + bonus}, or +${s.bonus + bonus} over better armor${cover}`;
  }
  if (item.kind !== 'weapon') return null;
  const w = item.weapon;
  const mod = w.damage.modifier + bonus;
  const parts = [
    `${w.damage.count}d${w.damage.sides}${mod > 0 ? `+${mod}` : ''}${w.damageAddsSkill ? ' + Punch' : ''} damage`,
    w.shock ? `Shock ${w.shock.damage}/AC ${w.shock.maxAc}` : 'no Shock',
    w.attributes.map((a) => ATTRIBUTES[a]).join('/'),
  ];
  if (w.range) parts.push(`range ${w.range.short}/${w.range.long}`);
  const traits = w.traits.map(
    (t) => (data.srd['weapon-traits'].find((x) => x.id === t) as WeaponTrait).name,
  );
  return [...parts, ...traits].join(', ');
}
