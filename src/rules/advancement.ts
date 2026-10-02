// vendor/wwn-srd/2.0 The Rules of the Game/2.7.0 Character Advancement.md
// XP past 10th: docs/decisions/0001-high-level-progression.md.

/** The SRD "Fast" table for levels 1–10. */
const FAST_XP = [0, 3, 6, 12, 18, 27, 39, 54, 72, 93] as const;
/** The 9th-to-10th step; each later step is 3 larger than the one before. */
const LAST_SRD_STEP = 21;
const STEP_GROWTH = 3;

export function xpForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new Error(`invalid level ${level}`);
  const table = FAST_XP[level - 1];
  if (table !== undefined) return table;
  const n = level - FAST_XP.length;
  return FAST_XP[9] + LAST_SRD_STEP * n + (STEP_GROWTH * n * (n + 1)) / 2;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export const SKILL_POINTS_PER_LEVEL = 3;
export const QUICK_LEARNER_BONUS = 1;

export function skillPointsPerLevel(quickLearner: boolean): number {
  return SKILL_POINTS_PER_LEVEL + (quickLearner ? QUICK_LEARNER_BONUS : 0);
}

/** Indexed by the skill level being bought, 0–4. */
const SKILL_COST = [1, 2, 3, 4, 5] as const;
const SKILL_MIN_CHARACTER_LEVEL = [1, 1, 3, 6, 9] as const;
export const MAX_SKILL_LEVEL = 4;

export type CostResult =
  { ok: true; cost: number } | { ok: false; reason: 'at-maximum' | 'character-level' };

/** The cost of the next skill level; levels must be bought in order. */
export function skillRaiseCost(current: number | null, characterLevel: number): CostResult {
  const next = current === null ? 0 : current + 1;
  const cost = SKILL_COST[next];
  const minLevel = SKILL_MIN_CHARACTER_LEVEL[next];
  if (cost === undefined || minLevel === undefined) return { ok: false, reason: 'at-maximum' };
  if (characterLevel < minLevel) return { ok: false, reason: 'character-level' };
  return { ok: true, cost };
}

export const MAX_ATTRIBUTE_BOOSTS = 5;
/** The 3rd, 4th, and 5th boosts need character levels 3, 6, and 9. */
const BOOST_MIN_LEVEL: Readonly<Record<number, number>> = { 3: 3, 4: 6, 5: 9 };

/** The nth attribute boost costs n skill points. */
export function attributeBoostCost(boostsTaken: number, characterLevel: number): CostResult {
  const boost = boostsTaken + 1;
  if (boost > MAX_ATTRIBUTE_BOOSTS) return { ok: false, reason: 'at-maximum' };
  if (characterLevel < (BOOST_MIN_LEVEL[boost] ?? 1))
    return { ok: false, reason: 'character-level' };
  return { ok: true, cost: boost };
}
