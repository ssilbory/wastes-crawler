// SRD 1.7.7 Choose Starting Gear: a starting package, or 3d6 x 10 silver (crowns) to spend.
// Small armor and barding: docs/rules-adaptation.md.
import type { People, StartingPackage } from '../../data/schemas/index.ts';
import { roll } from '../../rules/dice.ts';
import type { Rng } from '../../rules/rng.ts';
import type { GameData } from './context.ts';
import { inventoryErrors, loadoutLoad, type Loadout } from './equipment.ts';
import { entryPrice, findItem, type InventoryEntry } from './items.ts';
import { fail, INCOMPLETE, OK, type StepStatus } from './steps.ts';

export type GearChoice =
  | { mode: 'package'; packageId: string | null }
  /** `crowns` is the rolled starting money, or null before the roll. */
  | { mode: 'shop'; crowns: number | null; items: InventoryEntry[] };

export function rollStartingCrowns(rng: Rng, data: GameData): number {
  const { dice, multiplier } = data.content.equipmentRules.startingCrowns;
  return roll(rng, dice).total * multiplier;
}

/**
 * Fits an item to the people: armor is small for small peoples, and a centaur's worn body armor
 * comes with matching barding.
 */
export function sizeEntries(data: GameData, entries: readonly InventoryEntry[], people: People) {
  return entries.flatMap((entry): InventoryEntry[] => {
    if (findItem(data, entry.id)?.kind !== 'armor') return [entry];
    const sized: InventoryEntry = people.size === 'small' ? { ...entry, small: true } : entry;
    const barding = people.barding && entry.location === 'worn' && !entry.barding;
    return barding ? [sized, { ...entry, barding: true }] : [sized];
  });
}

export function packageInventory(
  data: GameData,
  pkg: StartingPackage,
  people: People,
): InventoryEntry[] {
  return sizeEntries(data, pkg.items, people);
}

export interface GearOutcome {
  status: StepStatus;
  inventory: InventoryEntry[];
  /** Money left over, in tenths of a crown. */
  tenths: number;
}

/** Validates the chosen gear against the character's people, Strength, and foci. */
export function evaluateGear(
  data: GameData,
  choice: GearChoice | null,
  loadout: Omit<Loadout, 'entries'>,
): GearOutcome {
  const none = (status: StepStatus): GearOutcome => ({ status, inventory: [], tenths: 0 });
  if (!choice) return none(INCOMPLETE);
  let inventory: InventoryEntry[];
  let tenths: number;
  if (choice.mode === 'package') {
    if (choice.packageId === null) return none(INCOMPLETE);
    const pkg = data.content.startingPackages.find((p) => p.id === choice.packageId);
    if (!pkg) return none(fail(`unknown starting package ${choice.packageId}`));
    inventory = packageInventory(data, pkg, loadout.people);
    tenths = pkg.crowns * 10;
  } else {
    if (choice.crowns === null) return none(INCOMPLETE);
    inventory = choice.items;
    let spent = 0;
    for (const entry of inventory) {
      const item = findItem(data, entry.id);
      if (!item?.cost) return none(fail(`${entry.id} isn't for sale`));
      spent += entryPrice(data, item, entry);
    }
    tenths = choice.crowns * 10 - spent;
    if (tenths < 0) return none(fail(`that costs ${spent / 10} crowns; you have ${choice.crowns}`));
  }
  const errors = inventoryErrors(data, inventory, loadout.people);
  if (errors.length > 0) return { status: fail(errors.join('; ')), inventory, tenths };
  const load = loadoutLoad(data, { ...loadout, entries: inventory });
  if (load.state === 'too-heavy') {
    return { status: fail(`too heavy to carry (${load.excess} items over)`), inventory, tenths };
  }
  return { status: OK, inventory, tenths };
}
