// Item catalog over vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/ (3.2.0 gear and bundles,
// 3.4.0 armor, 3.5.0 weapons), with the house shields, small armor, and barding rules from
// docs/rules-adaptation.md, and crafted quality tiers from vendor/wwn-srd/2.0 The Rules of the
// Game/2.8.0 Crafting and Modifying Gear.md (2.8.1).
import type {
  Armor,
  Cost,
  Gear,
  GearBundle,
  ItemLocation,
  Quality,
  Shield,
  Weapon,
} from '../../data/schemas/index.ts';
import type { GameData } from './context.ts';
import { upgrade } from './upgrades.ts';

export type CatalogItem =
  | { kind: 'weapon'; id: string; name: string; cost: Cost | null; weapon: Weapon }
  | { kind: 'armor'; id: string; name: string; cost: Cost | null; armor: Armor }
  | { kind: 'shield'; id: string; name: string; cost: Cost; shield: Shield }
  | { kind: 'gear'; id: string; name: string; cost: Cost; gear: Gear }
  | { kind: 'bundle'; id: string; name: string; cost: Cost; bundle: GearBundle };

/** One line of a character's inventory. */
export interface InventoryEntry {
  id: string;
  quantity: number;
  location: ItemLocation;
  /** Sized for a small people (docs/rules-adaptation.md, Small armor). */
  small?: true | undefined;
  /** Barding for a centaur's horse half. */
  barding?: true | undefined;
  /** A crafted item's tier (SRD 2.8.1); normal items have none. */
  quality?: Quality | undefined;
  serial?: string | undefined;
  maker?: string | undefined;
  mods?: InstalledMod[] | undefined;
  /** A magic weapon's bonus (SRD 4.9.3). */
  bonus?: number | undefined;
  /** Days since its mods were last maintained (SRD 2.8.3). */
  upkeep?: number | undefined;
}

export interface InstalledMod {
  id: string;
  components: string[];
  free?: true | undefined;
}

/** Content shields override the SRD shield rows; SRD armor keeps only body armor. */
export function catalog(data: GameData): CatalogItem[] {
  return [
    ...data.srd.weapons.map((w) => ({
      kind: 'weapon' as const,
      id: w.id,
      name: w.name,
      cost: w.cost,
      weapon: w,
    })),
    ...data.srd.armor
      .filter((a) => a.category !== 'shield')
      .map((a) => ({ kind: 'armor' as const, id: a.id, name: a.name, cost: a.cost, armor: a })),
    ...data.content.shields.map((s) => ({
      kind: 'shield' as const,
      id: s.id,
      name: s.name,
      cost: s.cost,
      shield: s,
    })),
    ...data.srd.gear.map((g) => ({
      kind: 'gear' as const,
      id: g.id,
      name: g.name,
      cost: g.cost,
      gear: g,
    })),
    // SRD 2.5.5's antitoxin, sold as the game's antidote (Sam's call).
    ((g) => ({ kind: 'gear' as const, id: g.id, name: g.name, cost: g.cost, gear: g }))(
      data.content.ailments.antidote,
    ),
    ...data.srd['gear-bundles'].map((b) => ({
      kind: 'bundle' as const,
      id: b.id,
      name: b.name,
      cost: b.cost,
      bundle: b,
    })),
  ];
}

export function findItem(data: GameData, id: string): CatalogItem | undefined {
  return catalog(data).find((i) => i.id === id);
}

/** Items a shop sells: everything with a price. */
export function buyable(data: GameData): CatalogItem[] {
  return catalog(data).filter((i) => i.cost !== null);
}

const TENTHS = { cp: 1, sp: 10, gp: 100 } as const;

/** Money in tenths of a crown; 1 crown = 1 silver piece (SRD 3.1.0: 10 cp = 1 sp, 10 sp = 1 gp). */
export function tenths(cost: Cost): number {
  return Math.round(cost.amount * TENTHS[cost.unit]);
}

/** Market value of an inventory line: crafted tiers are worth what their parts cost (SRD 2.8.1). */
export function entryPrice(data: GameData, item: CatalogItem, entry: InventoryEntry): number {
  if (!item.cost) return 0;
  const barding = entry.barding ? data.content.equipmentRules.barding.costMultiplier : 1;
  const tier = entry.quality ? data.content.craftingRules.quality[entry.quality].cost : 1;
  // A magic weapon is worth its commission besides (Sam's call).
  const magic = data.content.craftingRules.magic.tiers.find((t) => t.bonus === entry.bonus);
  const each = tenths(item.cost) * barding * tier + (magic ? magic.commission * 10 : 0);
  return Math.round(each * entry.quantity);
}

/** Encumbrance points of one inventory line (SRD 3.2.0 markers, the N trait, and barding). */
export function entryEncumbrance(data: GameData, item: CatalogItem, entry: InventoryEntry): number {
  const q = entry.quantity;
  const rules = data.content.equipmentRules;
  switch (item.kind) {
    case 'weapon': {
      const enc = item.weapon.encumbrance ?? 0;
      const numerous = item.weapon.traits.includes(rules.numerous.trait);
      return numerous ? Math.ceil(q / rules.numerous.perItem) * enc : q * enc;
    }
    case 'armor': {
      const mult = entry.barding ? rules.barding.encumbranceMultiplier : 1;
      // SRD 2.8.1: mastercrafted armor counts as 1 fewer point, down to a minimum of 1; a working
      // Tailored Harness takes off one more (2.8.4).
      const enc = item.armor.encumbrance ?? 0;
      const master = entry.quality === 'mastercrafted' ? Math.min(enc, Math.max(1, enc - 1)) : enc;
      const each = Math.max(0, master + upgrade(data, entry).encumbrance);
      return q * each * mult;
    }
    case 'shield':
      return q * item.shield.encumbrance;
    case 'bundle':
      return q * item.bundle.encumbrance;
    case 'gear': {
      const g = item.gear;
      if (g.weightless || g.encumbrance === null) return 0;
      if (g.freeWhenWorn && entry.location === 'worn') return 0;
      return g.bundlesOfThree ? Math.ceil(q / 3) * g.encumbrance : q * g.encumbrance;
    }
  }
}

/** A line's name with what sets it apart: "Pieced Armor (barding)", "Spear +1 (mastercrafted)". */
export function lineLabel(data: GameData, e: InventoryEntry): string {
  const name = findItem(data, e.id)?.name ?? e.id;
  const mods = (e.mods ?? []).map(
    (m) => data.content.mods.find((x) => x.id === m.id)?.name ?? m.id,
  );
  const notes = [e.quality, ...mods, e.small && 'small', e.barding && 'barding'].filter(Boolean);
  return `${name}${e.bonus ? ` +${e.bonus}` : ''}${notes.length ? ` (${notes.join(', ')})` : ''}`;
}
