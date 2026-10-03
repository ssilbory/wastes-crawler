import type { ContentData } from './schemas/index.ts';

/** XP tiers run from the highest win rate down to a tier that catches every fight. */
export function townReferenceErrors(content: ContentData): string[] {
  const errors: string[] = [];
  const tiers = content.townRules.xp.tiers;
  if (tiers.some((t, i) => i > 0 && t.minWinRate >= (tiers[i - 1] as typeof t).minWinRate))
    errors.push('townRules: XP tiers must run from the highest win rate down');
  if (tiers[tiers.length - 1]?.minWinRate !== 0)
    errors.push('townRules: the last XP tier must start at a 0 win rate');
  if (content.benchmarkWarrior.classes.current !== 'full-warrior')
    errors.push('benchmarkWarrior: must be a Warrior');
  return errors;
}
