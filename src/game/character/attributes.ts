// vendor/wwn-srd/1.0 Character Creation/1.1.0 Attributes.md and 1.3.0 Backgrounds.md (1.3.1);
// Goblin modifiers and the array-only rule: docs/rules-adaptation.md.
import type { Attribute, People } from '../../data/schemas/index.ts';
import type { AttributeScores } from '../../rules/attributes.ts';

export const ATTRIBUTES: readonly Attribute[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const PHYSICAL: readonly Attribute[] = ['str', 'dex', 'con'];
export const MENTAL: readonly Attribute[] = ['int', 'wis', 'cha'];
export const STANDARD_ARRAY = [14, 12, 11, 10, 9, 7] as const;
export const MIN_SCORE = 3;
export const MAX_SCORE = 18;

export type Adjustments = Partial<Record<Attribute, number>>;

/** True when the six scores are exactly the standard array in some order. */
export function isStandardArray(scores: AttributeScores): boolean {
  const values = ATTRIBUTES.map((a) => scores[a]).sort((x, y) => y - x);
  return values.every((v, i) => v === STANDARD_ARRAY[i]);
}

export function addAdjustments(scores: AttributeScores, adj: Adjustments): AttributeScores {
  const out = { ...scores };
  for (const a of ATTRIBUTES) out[a] += adj[a] ?? 0;
  return out;
}

/** Applies a people's modifiers within 3–18, returning what was actually applied. */
export function applyPeople(
  base: AttributeScores,
  people: People,
): { scores: AttributeScores; applied: Adjustments } {
  const scores = { ...base };
  const applied: Adjustments = {};
  for (const a of ATTRIBUTES) {
    const target = Math.min(
      MAX_SCORE,
      Math.max(MIN_SCORE, base[a] + (people.attributeModifiers[a] ?? 0)),
    );
    if (target !== base[a]) applied[a] = target - base[a];
    scores[a] = target;
  }
  return { scores, applied };
}

export type BonusError = 'wrong-total' | 'wrong-pool' | 'over-18';

/**
 * A Growth bonus such as "+2 Physical": all to one attribute, or split 1/1 between two. Each part
 * is a positive integer and the parts sum to the bonus, so a bonus can't spread wider than that.
 */
export function checkAttributeBonus(
  scores: AttributeScores,
  amount: number,
  pool: 'any' | 'physical' | 'mental',
  allocation: Adjustments,
): BonusError | null {
  const entries = Object.entries(allocation) as [Attribute, number][];
  const allowed = pool === 'physical' ? PHYSICAL : pool === 'mental' ? MENTAL : ATTRIBUTES;
  if (entries.some(([, v]) => !Number.isInteger(v) || v < 1)) return 'wrong-total';
  if (entries.reduce((n, [, v]) => n + v, 0) !== amount) return 'wrong-total';
  if (entries.some(([a]) => !allowed.includes(a))) return 'wrong-pool';
  if (entries.some(([a, v]) => scores[a] + v > MAX_SCORE)) return 'over-18';
  return null;
}
