// vendor/wwn-srd/1.0 Character Creation/1.1.0 Attributes.md (1.1.2 Attribute Modifiers)
import type { Attribute } from '../data/schemas/index.ts';

export type AttributeScores = Record<Attribute, number>;

/** 3 → −2, 4–7 → −1, 8–13 → 0, 14–17 → +1, 18 → +2; scores outside 3–18 stay within ±2. */
export function attributeModifier(score: number): number {
  if (score <= 3) return -2;
  if (score <= 7) return -1;
  if (score <= 13) return 0;
  if (score <= 17) return 1;
  return 2;
}

export function bestModifier(scores: AttributeScores, attributes: readonly Attribute[]): number {
  return Math.max(...attributes.map((a) => attributeModifier(scores[a])));
}
