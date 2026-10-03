// Class tables: vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/*.md, extracted to data/srd.
// Past 10th level and class switching: docs/rules-adaptation.md and
// docs/decisions/0001-high-level-progression.md.
import type { CastingProgression, Dice, Progression } from '../data/schemas/index.ts';

const SRD_MAX_LEVEL = 10;
const CYCLE_START = 3;
const CYCLE_LENGTH = SRD_MAX_LEVEL - CYCLE_START + 1;
export const MAX_SPELL_LEVEL = 5;
export const SWITCH_MIN_CLASS_LEVEL = 4;

function srdRow<T extends { level: number }>(levels: readonly T[], level: number): T {
  const row = levels[level - 1];
  if (level < 1 || !row || row.level !== level)
    throw new Error(`no class table row for level ${level}`);
  return row;
}

/**
 * A cumulative column past 10th: levels 11–18 add the gains of levels 3–10, then the cycle repeats.
 * One full cycle adds (row 10 − row 2), and a partial cycle of r levels adds (row 2+r − row 2).
 */
function extended(level: number, column: (srdLevel: number) => number): number {
  if (level <= SRD_MAX_LEVEL) return column(level);
  const over = level - SRD_MAX_LEVEL;
  const cycles = Math.floor(over / CYCLE_LENGTH);
  const partial = over % CYCLE_LENGTH;
  return (
    column(SRD_MAX_LEVEL) +
    cycles * (column(SRD_MAX_LEVEL) - column(2)) +
    (column(2 + partial) - column(2))
  );
}

/** The SRD level whose per-level gains (focus picks, arts) a level past 10th repeats. */
export function cycleSourceLevel(level: number): number {
  if (level <= SRD_MAX_LEVEL) return level;
  return CYCLE_START + ((level - SRD_MAX_LEVEL - 1) % CYCLE_LENGTH);
}

export interface ClassLevelRow {
  level: number;
  /** Cumulative hit dice, such as 3d6+6 for a 3rd-level Warrior. */
  hitDice: Dice;
  attackBonus: number;
  /** Focus picks gained at this level. */
  focusPicks: Progression['levels'][number]['focusPicks'];
}

export function progressionRow(p: Progression, level: number): ClassLevelRow {
  if (!Number.isInteger(level) || level < 1) throw new Error(`invalid class level ${level}`);
  const row = (l: number) => srdRow(p.levels, l);
  return {
    level,
    hitDice: {
      count: extended(level, (l) => row(l).hitDice.count),
      sides: row(1).hitDice.sides,
      modifier: extended(level, (l) => row(l).hitDice.modifier),
    },
    attackBonus: extended(level, (l) => row(l).attackBonus),
    focusPicks: row(cycleSourceLevel(level)).focusPicks,
  };
}

/** The single die a class level adds, such as 1d6+2 for a Warrior or 1d6-1 for a Mage. */
export function levelHitDie(p: Progression, level: number): Dice {
  const now = progressionRow(p, level).hitDice;
  if (level === 1) return now;
  const before = progressionRow(p, level - 1).hitDice;
  return {
    count: now.count - before.count,
    sides: now.sides,
    modifier: now.modifier - before.modifier,
  };
}

export interface CastingLevelRow {
  level: number;
  maxSpellLevel: number;
  spellsCast: number;
  spellsPrepared: number;
  /** Named arts and free art picks gained at this level. */
  arts: string[];
  anyArts: number;
}

export function castingRow(c: CastingProgression, level: number): CastingLevelRow {
  if (!Number.isInteger(level) || level < 1) throw new Error(`invalid class level ${level}`);
  const row = (l: number) => srdRow(c.levels, l);
  const gains = row(cycleSourceLevel(level));
  return {
    level,
    maxSpellLevel: Math.min(
      MAX_SPELL_LEVEL,
      extended(level, (l) => row(l).maxSpellLevel),
    ),
    spellsCast: extended(level, (l) => row(l).spellsCast),
    spellsPrepared: extended(level, (l) => row(l).spellsPrepared),
    arts: gains.arts,
    anyArts: gains.anyArts,
  };
}

/** Levels held in each class, keyed by progression id; new levels go into `current`. */
export interface ClassLevels {
  current: string;
  levels: Readonly<Record<string, number>>;
}

export function startingClass(progressionId: string): ClassLevels {
  return { current: progressionId, levels: { [progressionId]: 1 } };
}

/** Own-property lookup, so ids like "constructor" never read from the prototype. */
function levelIn(c: ClassLevels, id: string): number {
  return Object.hasOwn(c.levels, id) ? (c.levels[id] as number) : 0;
}

export function characterLevel(c: ClassLevels): number {
  return Object.values(c.levels).reduce((a, b) => a + b, 0);
}

export type SwitchResult =
  | { ok: true; classes: ClassLevels }
  | { ok: false; reason: 'not-in-town' | 'current-below-4' | 'same-class' | 'unknown-class' };

/** Only in town, and only once the current class has reached 4th level; earlier classes keep their levels. */
export function switchClass(
  c: ClassLevels,
  target: string,
  inTown: boolean,
  isKnown: (progressionId: string) => boolean,
): SwitchResult {
  if (!isKnown(target)) return { ok: false, reason: 'unknown-class' };
  if (target === c.current) return { ok: false, reason: 'same-class' };
  if (!inTown) return { ok: false, reason: 'not-in-town' };
  if (levelIn(c, c.current) < SWITCH_MIN_CLASS_LEVEL) {
    return { ok: false, reason: 'current-below-4' };
  }
  return {
    ok: true,
    classes: { current: target, levels: { ...c.levels, [target]: levelIn(c, target) } },
  };
}

/** Adds a level to the current class and returns the class level gained. */
export function levelUp(c: ClassLevels): { classes: ClassLevels; classLevel: number } {
  const classLevel = levelIn(c, c.current) + 1;
  return { classes: { ...c, levels: { ...c.levels, [c.current]: classLevel } }, classLevel };
}

type Lookup = (progressionId: string) => Progression;

/** The sum of each class's table attack bonus at that class's own level. */
export function totalAttackBonus(c: ClassLevels, lookup: Lookup): number {
  return Object.entries(c.levels)
    .filter(([, level]) => level > 0)
    .reduce((sum, [id, level]) => sum + progressionRow(lookup(id), level).attackBonus, 0);
}

/** One die per level held, each from the class the level was taken in. */
export function hitDiceForLevels(c: ClassLevels, lookup: Lookup): Dice[] {
  return Object.entries(c.levels).flatMap(([id, level]) =>
    Array.from({ length: level }, (_, i) => levelHitDie(lookup(id), i + 1)),
  );
}
