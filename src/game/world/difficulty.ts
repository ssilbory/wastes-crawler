// The XP house rule's difficulty (docs/rules-adaptation.md, XP): the party, as it stands when the
// fight starts, fights the encounter many times with auto-combat. What counts is how often a PC goes
// down. Each run uses its own seeded stream, never the world's RNG.
import { fightXp, type Tier } from '../../rules/economy.ts';
import { createRng } from '../../rules/rng.ts';
import { runBattle } from '../combat/battle.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { battleFrom, type PartySetup } from './fight.ts';
import type { World } from './types.ts';

export interface Difficulty {
  /** The share of simulated fights in which at least one PC ends dying, stabilized, or dead. */
  downRate: number;
  winRate: number;
}

const DOWN = new Set(['dying', 'stable', 'dead']);

/** The party's average PC level, rounded, counting the living. */
export function partyLevel(w: World, data: GameData): number {
  const levels = w.members
    .filter((m) => !m.dead)
    .map((m) => characterSheet(m.character, data).level);
  if (levels.length === 0) return 1;
  return Math.max(1, Math.round(levels.reduce((a, b) => a + b, 0) / levels.length));
}

/** A seed for the simulation from the world's RNG state, read without advancing it. */
export const difficultySeed = (w: World): string => `difficulty-${w.rng.state().join('-')}`;

export function simulateDifficulty(
  data: GameData,
  setup: PartySetup,
  seed: string,
  fights: number,
): Difficulty {
  let wins = 0;
  let downs = 0;
  for (let i = 0; i < fights; i++) {
    const battle = battleFrom(data, createRng(`${seed}-${i}`), setup, false);
    const result = runBattle(battle);
    if (result.outcome === 'party') wins += 1;
    const pcs = battle.combatants.filter((c) => c.id.startsWith('pc-'));
    if (pcs.some((c) => DOWN.has(c.status))) downs += 1;
  }
  return { downRate: downs / fights, winRate: wins / fights };
}

/** The tier and XP a won fight of this difficulty is worth. */
export function difficultyTier(data: GameData, d: Difficulty): Tier {
  const { tiers, deadlyWinRate } = data.content.townRules.xp;
  return fightXp(tiers, d.downRate, d.winRate, deadlyWinRate);
}
