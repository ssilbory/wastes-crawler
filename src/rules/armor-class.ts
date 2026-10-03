// vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/3.4.0 Armor.md, with the Shields and Centaur
// barding rules in docs/rules-adaptation.md and Impervious Defense from 1.6.0 Foci.md.

/** AC with no armor, and of an unbarded centaur's horse half. */
export const UNARMORED_AC = 10;

export interface ShieldRating {
  baseAc: number;
  bonus: number;
}

export interface ArmorClassInput {
  /** The worn armor's AC, or null for none. */
  armorAc: number | null;
  /** Only for a body that wears barding: its AC, or null for unbarded. */
  barding?: { ac: number | null };
  /** An innate AC floor such as Impervious Defense. */
  innateAc?: number;
  shield?: ShieldRating;
  dexModifier: number;
}

/** Impervious Defense: 15 plus half the character level, rounded up. */
export function innateArmorClass(base: number, level: number): number {
  return base + Math.ceil(level / 2);
}

/**
 * Body armor, averaged with barding (rounded down) for a centaur, then the better of an innate AC,
 * then the better of the shield's base AC or the armor plus its bonus, then Dex.
 */
export function armorClass(input: ArmorClassInput): number {
  let base = input.armorAc ?? UNARMORED_AC;
  if (input.barding) base = Math.floor((base + (input.barding.ac ?? UNARMORED_AC)) / 2);
  if (input.innateAc !== undefined) base = Math.max(base, input.innateAc);
  if (input.shield) base = Math.max(input.shield.baseAc, base + input.shield.bonus);
  return base + input.dexModifier;
}
