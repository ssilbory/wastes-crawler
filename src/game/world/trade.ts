// Trade (docs/rules-adaptation.md, Skills): the party's best trader haggles town prices down and the
// price of gear sold up by the same share.
import type { GameData } from '../character/context.ts';
import { alive } from './members.ts';
import type { Member, World } from './types.ts';

export interface Haggler {
  member: Member;
  percent: number;
}

/** The living member with the best Trade, and the share they haggle; null if no one has it. */
export function haggler(w: World, data: GameData): Haggler | null {
  const rules = data.content.skillRules.trade;
  let best: Member | undefined;
  for (const m of alive(w)) {
    const level = m.character.skills.trade;
    if (level !== undefined && level > (best?.character.skills.trade ?? -1)) best = m;
  }
  if (!best) return null;
  const level = best.character.skills.trade as number;
  const percent = Math.min(rules.maxPercent, rules.percentAtZero + level * rules.percentPerLevel);
  return { member: best, percent };
}

export const tradePercent = (w: World, data: GameData) => haggler(w, data)?.percent ?? 0;
