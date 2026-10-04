// vendor/wwn-srd/1.0 Character Creation/1.1.0 Attributes.md (1.1.1: 3d6 in order with one score
// swapped for 14, or the standard array) and 1.3.0 Backgrounds.md (1.3.1); people and lineage
// modifiers and the manual scores open after the free rerolls: docs/rules-adaptation.md.
import type { Attribute } from '../../data/schemas/index.ts';
import type { AttributeScores } from '../../rules/attributes.ts';
import { roll } from '../../rules/dice.ts';
import type { Rng } from '../../rules/rng.ts';

export const ATTRIBUTES: readonly Attribute[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const PHYSICAL: readonly Attribute[] = ['str', 'dex', 'con'];
export const MENTAL: readonly Attribute[] = ['int', 'wis', 'cha'];
export const STANDARD_ARRAY = [14, 12, 11, 10, 9, 7] as const;
export const MIN_SCORE = 3;
export const MAX_SCORE = 18;

export type Adjustments = Partial<Record<Attribute, number>>;

/** Rerolls allowed before the builder offers to take the scores the player wants (Sam's call). */
export const FREE_REROLLS = 3;

/**
 * How the base scores were made: the standard array; 3d6 in order, with at most one score swapped
 * for 14; or, after more than FREE_REROLLS rerolls, whatever the player names, 3 to 18.
 */
export type AttributeMethod =
  | { kind: 'array' }
  | { kind: 'roll'; rolled: AttributeScores; swap: Attribute | null; rerolls: number }
  | { kind: 'manual'; rerolls: number };

/** 3d6 in order, once for each attribute (SRD 1.1.1). */
export function rollAttributes(rng: Rng): AttributeScores {
  const out = {} as AttributeScores;
  for (const a of ATTRIBUTES) out[a] = roll(rng, { count: 3, sides: 6, modifier: 0 }).total;
  return out;
}

/** The rolled scores with the swapped one, if any, set to 14. */
export function withSwap(rolled: AttributeScores, swap: Attribute | null): AttributeScores {
  return swap ? { ...rolled, [swap]: 14 } : { ...rolled };
}

/** Why the base scores don't fit their method, or null if they do. */
export function scoresProblem(method: AttributeMethod, scores: AttributeScores): string | null {
  if (method.kind === 'array')
    return isStandardArray(scores) ? null : 'scores must be 14, 12, 11, 10, 9, and 7, one each';
  if (method.kind === 'roll') {
    const want = withSwap(method.rolled, method.swap);
    return ATTRIBUTES.every((a) => scores[a] === want[a])
      ? null
      : 'scores must be the ones rolled, with at most one set to 14';
  }
  if (method.rerolls <= FREE_REROLLS) return 'name your own scores only after the free rerolls';
  const bad = ATTRIBUTES.some(
    (a) => !Number.isInteger(scores[a]) || scores[a] < MIN_SCORE || scores[a] > MAX_SCORE,
  );
  return bad ? 'each score must be a whole number from 3 to 18' : null;
}

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

/** Applies a people's (and lineage's) modifiers within 3–18, returning what was actually applied. */
export function applyPeopleModifiers(
  base: AttributeScores,
  modifiers: Adjustments,
): { scores: AttributeScores; applied: Adjustments } {
  const scores = { ...base };
  const applied: Adjustments = {};
  for (const a of ATTRIBUTES) {
    const target = Math.min(MAX_SCORE, Math.max(MIN_SCORE, base[a] + (modifiers[a] ?? 0)));
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
