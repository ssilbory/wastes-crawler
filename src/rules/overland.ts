// Overland travel (docs/rules-adaptation.md, Overland travel; vendor/wwn-srd/2.0 The Rules of the
// Game/2.11.0 Overland Travel.md and 2.12.0 Wilderness Exploration and Expeditions.md): quarter
// days, hike costs, dark quarters, harsh nights, and the wandering encounter check.
import { rollDie } from './dice.ts';
import type { Rng } from './rng.ts';

export const QUARTERS = ['morning', 'day', 'evening', 'night'] as const;
export type Quarter = (typeof QUARTERS)[number];
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Movement = 'open' | 'difficult' | 'impassable';

/** Hike points per quarter: open hexes cost 1 and difficult ones 2, so 2 or 1 hexes. */
export const HIKE_POINTS = 2;
/** Quarters of hiking a day before each further one needs an Exert check. */
export const FREE_HIKES = 2;
export const EXERT_DIFFICULTY = 8;

export function moveCost(movement: Movement, road: boolean): number | null {
  if (movement === 'impassable') return null;
  return road || movement === 'open' ? 1 : 2;
}

/** Night is always dark; in winter, morning and evening are too. */
export function isDark(quarter: Quarter, season: Season): boolean {
  return quarter === 'night' || (season === 'winter' && quarter !== 'day');
}

/** A night that makes the unsheltered Cold: harsh terrain, or any winter night. */
export function isHarshNight(harshTerrain: boolean, season: Season): boolean {
  return harshTerrain || season === 'winter';
}

/** SRD 2.12.6: on a 1, something comes up. */
export function encounterCheck(rng: Rng, die: number): boolean {
  return rollDie(rng, die) === 1;
}
