// vendor/wwn-srd/1.0 Character Creation/1.1.0 Attributes.md (1.1.2 Attribute Modifiers)
// and the Developed Attribute focus in 1.6.0 Foci.md.
import type { Attribute } from '../data/schemas/index.ts';

export type AttributeScores = Record<Attribute, number>;

/**
 * 3 → −2, 4–7 → −1, 8–13 → 0, 14–17 → +1, 18 → +2; scores outside 3–18 stay within ±2. A missing
 * or non-numeric score throws rather than passing as the best modifier.
 */
export function attributeModifier(score: number): number {
  if (!Number.isFinite(score)) throw new RangeError(`not an attribute score: ${score}`);
  if (score <= 3) return -2;
  if (score <= 7) return -1;
  if (score <= 13) return 0;
  if (score <= 17) return 1;
  return 2;
}

/** Extra modifier per attribute, such as from the Developed Attribute focus. */
export type ModifierBonuses = Partial<Record<Attribute, number>>;

/** Developed Attribute raises a modifier "up to a maximum of +3" (1.6.0 Foci.md). */
export const MAX_BOOSTED_MODIFIER = 3;

export function boostedModifier(score: number, bonus = 0): number {
  const base = attributeModifier(score);
  return bonus === 0 ? base : Math.min(MAX_BOOSTED_MODIFIER, base + bonus);
}

export function bestModifier(
  scores: AttributeScores,
  attributes: readonly Attribute[],
  bonuses: ModifierBonuses = {},
): number {
  return Math.max(...attributes.map((a) => boostedModifier(scores[a], bonuses[a])));
}
