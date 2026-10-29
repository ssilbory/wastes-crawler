// How an encounter looks before the party chooses to fight (Sam's call, docs/rules-adaptation.md,
// XP): the tier the XP difficulty simulation puts it in, and how its trial fights went. Pure.
import type { GameData } from '../game/character/context.ts';
import { difficultyTier, type Difficulty } from '../game/world/difficulty.ts';

const percent = (n: number) => `${Math.round(n * 100)}%`;

/** "Looks hard: the party wins 82% of trial fights, and someone goes down in 45%." */
export function threatText(data: GameData, d: Difficulty): string {
  const tier = difficultyTier(data, d);
  return `Looks ${tier.name}: the party wins ${percent(d.winRate)} of trial fights, and someone goes down in ${percent(d.downRate)}.`;
}
