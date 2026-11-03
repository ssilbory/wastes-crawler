// Major projects' arithmetic (docs/rules-adaptation.md, Major projects, institutions, and
// recruits): vendor/wwn-srd/7.0 Major Projects/Determining the Project Difficulty.md (7.2.0),
// Determining the Project Scope.md (7.3.0), Determining the Opposition.md (7.4.0), Decreasing
// Difficulty.md (7.5.0), and Player Run Factions and Major Projects.md (7.9.0, at half strength).

export type Probability = 'plausible' | 'improbable' | 'impossible';
export type Scope = 'village' | 'city' | 'region' | 'kingdom' | 'world';
export type OppositionLevel = 'minor' | 'local' | 'major' | 'king';

/** SRD 7.2.0's base difficulty. */
export const PROBABILITY: Record<Probability, number> = {
  plausible: 1,
  improbable: 2,
  impossible: 4,
};
/** SRD 7.3.0's multiplier for the people the change touches. */
export const SCOPE: Record<Scope, number> = {
  village: 2,
  city: 4,
  region: 8,
  kingdom: 16,
  world: 32,
};
/** SRD 7.4.0's multiplier for the greatest power against it. */
export const OPPOSITION: Record<OppositionLevel, number> = {
  minor: 2,
  local: 4,
  major: 8,
  king: 16,
};

/**
 * SRD 7.4.0: base × scope × the greatest standing opposition (×1 with none), doubled when the
 * people affected are against the change.
 */
export function projectDifficulty(p: {
  probability: Probability;
  scope: Scope;
  opposition: OppositionLevel | null;
  popular: boolean;
}): number {
  const against = p.opposition ? OPPOSITION[p.opposition] : 1;
  return PROBABILITY[p.probability] * SCOPE[p.scope] * against * (p.popular ? 2 : 1);
}

/** The greatest of these levels, or null with none (SRD 7.4.0: only the greatest counts). */
export function greatestOpposition(levels: readonly OppositionLevel[]): OppositionLevel | null {
  return levels.reduce<OppositionLevel | null>(
    (best, l) => (best === null || OPPOSITION[l] > OPPOSITION[best] ? l : best),
    null,
  );
}

/**
 * The difficulty left once tied adventures (SRD 7.5.0: each takes its share of the goal) and
 * factions' help (7.9.0) have lowered it: the adventures' percent off, rounded up, then the
 * help; never below 1.
 */
export function loweredDifficulty(difficulty: number, adventurePercent: number, help: number) {
  const left = Math.ceil((difficulty * (100 - Math.min(100, adventurePercent))) / 100);
  return Math.max(1, left - help);
}

/** A band of SRD 7.5.0's table: this many points, at this many crowns each. */
export interface PriceBand {
  points: number;
  crowns: number;
}

/**
 * Crowns for buying `points` more Renown for a project that has had `bought` already, band by band
 * (SRD 7.5.0's table at 1/50); null past the last band, where more is not for sale.
 */
export function renownPrice(
  bands: readonly PriceBand[],
  bought: number,
  points: number,
): number | null {
  let cost = 0;
  let start = 0;
  for (const band of bands) {
    const end = start + band.points;
    const from = Math.max(start, bought);
    const to = Math.min(end, bought + points);
    if (to > from) cost += (to - from) * band.crowns;
    start = end;
  }
  return bought + points > start ? null : cost;
}

/**
 * SRD 7.9.0 at half strength (Sam's call): an allied faction's help takes off half its Force,
 * Cunning, and Wealth together, rounded up, doubled when it suits the project.
 */
export function factionHelp(
  ratings: { force: number; cunning: number; wealth: number },
  suits: boolean,
): number {
  const half = Math.ceil((ratings.force + ratings.cunning + ratings.wealth) / 2);
  return suits ? half * 2 : half;
}

// Magical Workings (vendor/wwn-srd/4.0 Magic and Spellcasting/4.8.0 Building Magical Workings.md;
// docs/rules-adaptation.md, Major projects: Workings, Designing, Building a Working).

export type Degree = 'trivial' | 'minor' | 'major' | 'great' | 'supreme';
export type WorkingArea = 'room' | 'building' | 'village' | 'city' | 'region';

/** SRD 4.8.2's table: the multiplier for the biggest area a Working touches. */
export const WORKING_AREA: Record<WorkingArea, number> = {
  room: 1,
  building: 4,
  village: 16,
  city: 64,
  region: 256,
};

/** SRD 4.8.1: a Working's difficulty, its points times its area's multiplier. */
export const workingDifficulty = (points: number, area: WorkingArea) => points * WORKING_AREA[area];

/** SRD 4.8.1: what a mage brings to a design, character level times Magic skill times two. */
export const designScore = (level: number, magic: number) => level * Math.max(0, magic) * 2;

/**
 * SRD 4.8.1: whether a design can be made: alone at the full difficulty, with help at half or more
 * (the lead's share), and never below half.
 */
export function designable(lead: number, help: number, difficulty: number): boolean {
  return lead * 2 >= difficulty && lead + help >= difficulty;
}

/** SRD 4.8.2: one month and a week for every 5 points or part of 5, halved at double the cost. */
export function workingDays(difficulty: number, month: number, double: boolean): number {
  const days = month + 7 * Math.ceil(difficulty / 5);
  return double ? Math.ceil(days / 2) : days;
}

/** Sam's call: the lead's final Int/Magic check, 8 plus the degree (trivial 0 to supreme 4). */
export function workingCheck(degree: Degree): number {
  return 8 + ['trivial', 'minor', 'major', 'great', 'supreme'].indexOf(degree);
}
