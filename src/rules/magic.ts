// Effort: vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.10 The High Mage.md (1.5.10.1)
// and 1.5.7 The Elementalist.md (1.5.7.1); one pool across classes and strain casting:
// docs/rules-adaptation.md. Armor while casting: 1.5.12 The Mage.md and Armored Magic (1.6.0).

export interface EffortInput {
  /** The best Effort skill level among the character's casting classes. */
  skill: number;
  /** The best Effort attribute modifier among those classes. */
  attributeModifier: number;
  /**
   * The best of each tradition's offset: 1 for a full Mage, 0 for a partial one (one lower), and 0
   * for the Blood Priest and Healer, whose Effort is just skill plus attribute (1.5.5.1, 1.5.9.1).
   */
  offset: number;
  /** Never below 1: any partial Mage, the Blood Priest, and the Healer. */
  floorOne: boolean;
}

/** offset + skill + attribute; never below 1 for partial casters and arts-only traditions. */
export function effortMaximum(input: EffortInput): number {
  const total = input.offset + input.skill + input.attributeModifier;
  return input.floorOne ? Math.max(1, total) : total;
}

/** Strain casting costs System Strain equal to the spell's level. */
export function strainCastCost(spellLevel: number): number {
  if (!Number.isInteger(spellLevel) || spellLevel < 1 || spellLevel > 5) {
    throw new Error(`invalid spell level ${spellLevel}`);
  }
  return spellLevel;
}

export interface ArmoredCasting {
  /** Heaviest armor encumbrance allowed, or null for any. */
  maxEncumbrance: number | null;
  shields: boolean;
}

/**
 * Mages can't cast in armor (even a war shirt) or with a shield, unless Armored Magic allows it.
 * `armor` lists the encumbrance of each worn suit, barding included.
 */
export function canCastIn(
  armor: readonly number[],
  shield: boolean,
  armored: ArmoredCasting | null,
): boolean {
  const armorOk = armor.every(
    (enc) => armored !== null && (armored.maxEncumbrance === null || enc <= armored.maxEncumbrance),
  );
  return armorOk && (!shield || armored?.shields === true);
}
