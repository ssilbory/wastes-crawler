import type { ContentData } from './schemas/index.ts';

/** XP tiers run from a 0 down rate, the easiest first, each harder than the last. */
export function townReferenceErrors(content: ContentData): string[] {
  const errors: string[] = [];
  const tiers = content.townRules.xp.tiers;
  if (tiers[0]?.minDownRate !== 0)
    errors.push('townRules: the first XP tier must start at a 0 down rate');
  if (tiers.some((t, i) => i > 0 && t.minDownRate <= (tiers[i - 1] as typeof t).minDownRate))
    errors.push('townRules: XP tiers must run from the lowest down rate up');
  return errors;
}
