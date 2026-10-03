// House rules, not in the SRD: docs/rules-adaptation.md (Progression and economy). SRD prices
// themselves come from vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/.
import type { Rng } from './rng.ts';

/** Crowns are kept to tenths (one copper piece). */
export const toTenths = (crowns: number): number => Math.round(crowns * 10) / 10;

/**
 * What `amount` crowns of listed prices cost when `spent` has already gone through a town with this
 * spending threshold. Past the threshold each crown costs `1 + rate × overage`, where overage is the
 * spending past the threshold as a fraction of it. The rate is integrated, so one big purchase costs
 * the same as the same goods bought one at a time.
 */
export function surchargedCost(
  spent: number,
  amount: number,
  threshold: number,
  rate: number,
): number {
  const over = (x: number) => Math.max(0, x - threshold);
  const extra = (rate / (2 * threshold)) * (over(spent + amount) ** 2 - over(spent) ** 2);
  return toTenths(amount + extra);
}

/** Crowns paid for the first `x` crowns of loot cashed in at a town (the payout's integral). */
function cumulativePayout(x: number, threshold: number, rate: number): number {
  if (x <= threshold) return x;
  // Past the threshold the payout per crown falls by `rate` per unit of overage, down to nothing.
  const over = rate === 0 ? x - threshold : Math.min(x - threshold, threshold / rate);
  return threshold + over - (rate * over ** 2) / (2 * threshold);
}

/**
 * What `amount` crowns of rolled loot pays when `looted` has already been cashed in at a town with
 * this loot threshold: in full below it, then `1 − rate × overage` per crown, never below nothing.
 */
export function lootPayout(
  looted: number,
  amount: number,
  threshold: number,
  rate: number,
): number {
  return toTenths(
    cumulativePayout(looted + amount, threshold, rate) - cumulativePayout(looted, threshold, rate),
  );
}

/** The economic climate: a whole-percent change to the party's crowns, from min to max. */
export function rollClimate(rng: Rng, minPercent: number, maxPercent: number): number {
  return rng.int(minPercent, maxPercent);
}

export interface Tier {
  name: string;
  minWinRate: number;
  xp: number;
}

/**
 * The XP for a fight from the benchmark row's simulated win rate: the first tier (highest win rate
 * first) the rate reaches, one tier harder when the fights average more than `longFightRounds`.
 */
export function fightXp(
  tiers: readonly Tier[],
  winRate: number,
  averageRounds: number,
  longFightRounds: number,
): Tier {
  const found = tiers.findIndex((t) => winRate >= t.minWinRate);
  const base = found < 0 ? tiers.length - 1 : found;
  const index = Math.min(tiers.length - 1, base + (averageRounds > longFightRounds ? 1 : 0));
  const tier = tiers[index];
  if (!tier) throw new Error('no XP tiers');
  return tier;
}
