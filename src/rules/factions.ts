// Faction arithmetic from vendor/wwn-srd/6.0 Factions/: attribute checks (Attribute Checks.md),
// income (The Faction Turn.md), hit points and experience costs (Creating Factions.md), and repair
// (Faction Turn Actions.md).
import { rollDie } from './dice.ts';
import type { Rng } from './rng.ts';

export interface Ratings {
  force: number;
  cunning: number;
  wealth: number;
}

/** One side of an attribute check: its rating, and the dice it rolls (a tag may add one). */
export interface CheckSide {
  rating: number;
  dice: number;
}

/** Best of `dice` d10s plus the rating. */
function checkRoll(rng: Rng, side: CheckSide): number {
  let best = 0;
  for (let i = 0; i < side.dice; i++) best = Math.max(best, rollDie(rng, 10));
  return best + side.rating;
}

/** 6.4.0: 1d10 plus the attribute each; the attacker wins only with the higher total. */
export function attackerWins(rng: Rng, attacker: CheckSide, defender: CheckSide): boolean {
  return checkRoll(rng, attacker) > checkRoll(rng, defender);
}

/** 6.2.0: half Wealth plus a quarter of Force and Cunning together, rounded up. */
export const factionIncome = (r: Ratings) => Math.ceil(r.wealth / 2 + (r.force + r.cunning) / 4);

/** 6.7.0: hit points and the experience cost to buy each rating, from 1 to 8. */
const HIT_POINTS = [1, 2, 4, 6, 9, 12, 16, 20];
const XP_COST = [0, 2, 4, 6, 9, 12, 16, 20];

export const MAX_RATING = 8;

function checkRating(rating: number): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > MAX_RATING)
    throw new Error(`invalid faction rating ${rating}`);
}

/** A faction's maximum hit points: the sum of each attribute's value on the table. */
export function factionMaxHp(r: Ratings): number {
  return [r.force, r.cunning, r.wealth].reduce((sum, rating) => {
    checkRating(rating);
    return sum + (HIT_POINTS[rating - 1] as number);
  }, 0);
}

/** Experience to raise an attribute from `rating` to the next, or null at the top. */
export function raiseCost(rating: number): number | null {
  checkRating(rating);
  return rating === MAX_RATING ? null : (XP_COST[rating] as number);
}

/** 6.6.0 Repair Asset: half the asset's attribute, rounded up, for each fix. */
export const assetRepair = (rating: number) => Math.ceil(rating / 2);

/** The Treasure the nth fix on the same asset in one turn costs: 1, then 2, then 3. */
export const repairCost = (nth: number) => nth;

/** 6.6.0: one faction repair a turn heals its highest and lowest attribute over two, rounded up. */
export function factionRepair(r: Ratings): number {
  const all = [r.force, r.cunning, r.wealth];
  return Math.ceil((Math.max(...all) + Math.min(...all)) / 2);
}

/** 6.7.0 goals: Root Out the Enemy is half the ruler's average attribute, rounded up. */
export function rootOutDifficulty(ruler: Ratings): number {
  return Math.ceil((ruler.force + ruler.cunning + ruler.wealth) / 3 / 2);
}

/** Blood the Enemy: damage equal to the faction's own Force, Cunning, and Wealth together. */
export const bloodTarget = (r: Ratings) => r.force + r.cunning + r.wealth;
