// Weapons and armor dropped after a won fight (docs/rules-adaptation.md, Gear drops; Sam's calls).
// The quality tier follows the party's level: jury-rigged early, normal later, mastercrafted at
// high level (the tiers are vendor/wwn-srd/2.0 The Rules of the Game/2.8.0 Crafting and Modifying
// Gear.md, 2.8.1). A drop costs the fight some of its loot dice, never more than a quarter of them.
import type { LootDice } from '../data/schemas/index.ts';
import type { Rng } from './rng.ts';

/** Weights for each tier a dropped item can be, by party level. */
export interface DropBand {
  minLevel: number;
  weights: Record<'jury-rigged' | 'normal' | 'mastercrafted', number>;
}

export type DropTier = keyof DropBand['weights'];

const TIERS: readonly DropTier[] = ['jury-rigged', 'normal', 'mastercrafted'];

/** The band for a party level: the one with the highest minimum at or below it. */
export function bandAt(bands: readonly DropBand[], level: number): DropBand {
  const fits = bands.filter((b) => b.minLevel <= level);
  const pool = fits.length > 0 ? fits : [...bands].sort((a, b) => a.minLevel - b.minLevel);
  return pool.reduce((a, b) => (b.minLevel > a.minLevel ? b : a));
}

/** Draws one entry by weight; zero weights never come up. */
export function pickWeighted<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
  const live = entries.filter(([, weight]) => weight > 0);
  if (live.length === 0) throw new Error('nothing to pick: every weight is zero');
  let pick = rng.int(
    1,
    live.reduce((sum, [, weight]) => sum + weight, 0),
  );
  return (live.find(([, weight]) => (pick -= weight) <= 0) as readonly [T, number])[0];
}

/** Draws a dropped item's tier for a party level. */
export function dropTier(rng: Rng, bands: readonly DropBand[], level: number): DropTier {
  const { weights } = bandAt(bands, level);
  return pickWeighted(
    rng,
    TIERS.map((t) => [t, weights[t]] as const),
  );
}

/** A loot die's average roll, in crowns at the loot exchange. */
const average = (sides: number) => (sides + 1) / 2;

/**
 * Takes loot dice off a fight's winnings to pay for a dropped item worth `value` crowns: the
 * smallest dice first, until the dice taken average at least the item's worth, but always leaving
 * at least `keep` of the dice (a share, rounded up).
 */
export function cutLoot(dice: readonly LootDice[], value: number, keep: number): LootDice[] {
  const singles = dice.flatMap((d) => Array<number>(d.count).fill(d.sides)).sort((a, b) => a - b);
  const floor = Math.ceil(singles.length * keep);
  let taken = 0;
  while (taken < value && singles.length > floor) taken += average(singles.shift() as number);
  const left = new Map<number, number>();
  for (const sides of singles) left.set(sides, (left.get(sides) ?? 0) + 1);
  return [...left].map(([sides, count]) => ({ count, sides }));
}
