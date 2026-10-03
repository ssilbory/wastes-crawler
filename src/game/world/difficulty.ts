// The XP house rule's benchmark (docs/rules-adaptation.md, XP): one row of four Warriors at the
// party's average level fights the encounter's enemies many times with auto-combat. Each run uses
// its own seeded stream, never the world's RNG. Hit points per level: vendor/wwn-srd/2.0 The Rules
// of the Game/2.7.0 Character Advancement.md (2.7.1.1), taken at the average roll.
import type { Character } from '../../data/schemas/index.ts';
import { fightXp, type Tier } from '../../rules/economy.ts';
import { DIE_HARD_BONUS } from '../../rules/hit-points.ts';
import { hitDiceForLevels } from '../../rules/progression.ts';
import { createRng } from '../../rules/rng.ts';
import { createBattle, runBattle } from '../combat/battle.ts';
import { progressionLookup, type GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { hasDieHard } from '../character/foci.ts';
import type { World } from './types.ts';

export const BENCHMARK_SIZE = 4;

export interface Difficulty {
  winRate: number;
  averageRounds: number;
}

/** The benchmark Warrior at a level, with average hit points. */
export function benchmarkWarrior(data: GameData, level: number): Character {
  const base = data.content.benchmarkWarrior;
  const classes = { current: base.classes.current, levels: { [base.classes.current]: level } };
  const con = characterSheet(base, data).modifiers.con;
  const bonus = con + (hasDieHard(data, base.foci) ? DIE_HARD_BONUS : 0);
  const max = hitDiceForLevels(classes, progressionLookup(data)).reduce(
    (sum, d) => sum + Math.max(1, Math.floor((d.count * (d.sides + 1)) / 2 + d.modifier + bonus)),
    0,
  );
  return { ...base, classes, hp: { max, current: max } };
}

/** The party's average PC level, rounded, counting the living. */
export function partyLevel(w: World, data: GameData): number {
  const levels = w.members
    .filter((m) => !m.dead)
    .map((m) => characterSheet(m.character, data).level);
  if (levels.length === 0) return 1;
  return Math.max(1, Math.round(levels.reduce((a, b) => a + b, 0) / levels.length));
}

/** A seed for the benchmark from the world's RNG state, read without advancing it. */
export const benchmarkSeed = (w: World): string => `benchmark-${w.rng.state().join('-')}`;

export function simulateDifficulty(
  data: GameData,
  enemies: readonly (readonly string[])[],
  level: number,
  seed: string,
  fights: number,
): Difficulty {
  const warrior = benchmarkWarrior(data, level);
  const party = Array.from({ length: BENCHMARK_SIZE }, (_, column) => ({
    character: { ...warrior, name: `Warrior ${column + 1}` },
    row: 0,
    column,
  }));
  let wins = 0;
  let rounds = 0;
  for (let i = 0; i < fights; i++) {
    const battle = createBattle({
      data,
      rng: createRng(`${seed}-${i}`),
      party,
      enemies: enemies.map((r) => [...r]),
      log: false,
    });
    const result = runBattle(battle);
    if (result.outcome === 'party') wins += 1;
    rounds += result.rounds;
  }
  return { winRate: wins / fights, averageRounds: rounds / fights };
}

/** The tier and XP a won fight of this difficulty is worth. */
export function difficultyTier(data: GameData, d: Difficulty): Tier {
  const { tiers, longFightRounds } = data.content.townRules.xp;
  return fightXp(tiers, d.winRate, d.averageRounds, longFightRounds);
}
