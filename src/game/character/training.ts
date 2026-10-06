// Spending skill points between levels: vendor/wwn-srd/2.0 The Rules of the Game/2.7.0 Character
// Advancement.md (2.7.1.4 skills, 2.7.1.5 attributes, 2.7.1.6 a focus's bonus skill as three
// points), the Expert's Quick Learner (1.0 Character Creation/1.5.0 Class List/1.5.8 The
// Expert.md), preparing spells (4.0 Magic and Spellcasting/4.2.0), and class switching
// (docs/rules-adaptation.md).
import type { Attribute, Character } from '../../data/schemas/index.ts';
import { attributeBoostCost, MAX_SKILL_LEVEL, skillRaiseCost } from '../../rules/advancement.ts';
import { switchClass } from '../../rules/progression.ts';
import { classOption } from './class-step.ts';
import { findProgression, isSkill, type GameData } from './context.ts';
import { characterSheet, finalScores } from './derived.ts';
import { COMBAT_SKILLS } from './skills.ts';

export type TrainResult = { ok: true; character: Character } | { ok: false; reason: string };

const MAX_SCORE = 18;
const no = (reason: string): TrainResult => ({ ok: false, reason });
const level = (data: GameData, c: Character) => characterSheet(c, data).level;
const without = (credit: Record<string, number>, skill: string) =>
  Object.fromEntries(Object.entries(credit).filter(([k]) => k !== skill));

/** Pays `cost` from Quick Learner points first where they're allowed, then from skill points. */
function pay(c: Character, cost: number, quickAllowed: boolean): Character | null {
  const { skillPoints, quickPoints } = c.advancement;
  const quick = quickAllowed ? Math.min(quickPoints, cost) : 0;
  if (skillPoints + quick < cost) return null;
  return {
    ...c,
    advancement: {
      ...c.advancement,
      quickPoints: quickPoints - quick,
      skillPoints: skillPoints - (cost - quick),
    },
  };
}

/** Raises a skill one level with saved points, using any credit toward it first. */
export function raiseSkill(data: GameData, c: Character, skill: string): TrainResult {
  if (!isSkill(data, skill)) return no(`unknown skill ${skill}`);
  const current = Object.hasOwn(c.skills, skill) ? (c.skills[skill] as number) : null;
  const cost = skillRaiseCost(current, level(data, c));
  if (!cost.ok) {
    return no(
      cost.reason === 'at-maximum'
        ? `${skill} is at its maximum`
        : `${skill} needs a higher character level`,
    );
  }
  const credit = c.advancement.skillCredit[skill] ?? 0;
  const paid = pay(c, Math.max(0, cost.cost - credit), !COMBAT_SKILLS.includes(skill));
  if (!paid) return no(`that costs ${cost.cost - credit} skill points`);
  const skillCredit = without(paid.advancement.skillCredit, skill);
  return {
    ok: true,
    character: {
      ...paid,
      skills: { ...paid.skills, [skill]: current === null ? 0 : current + 1 },
      advancement: { ...paid.advancement, skillCredit },
    },
  };
}

/**
 * A focus's bonus skill gained by advancement: three points toward the skill, buying levels even
 * past the character-level minimum; what's left stays as credit. Points a skill at level-4 can't use,
 * already there or reached now, become ordinary skill points.
 */
export function creditSkill(c: Character, skill: string, points: number): Character {
  let current = Object.hasOwn(c.skills, skill) ? (c.skills[skill] as number) : null;
  if (current === MAX_SKILL_LEVEL) {
    return {
      ...c,
      advancement: { ...c.advancement, skillPoints: c.advancement.skillPoints + points },
    };
  }
  let credit = (c.advancement.skillCredit[skill] ?? 0) + points;
  for (;;) {
    const cost = skillRaiseCost(current, Number.MAX_SAFE_INTEGER);
    if (!cost.ok || cost.cost > credit) break;
    credit -= cost.cost;
    current = current === null ? 0 : current + 1;
  }
  const others = without(c.advancement.skillCredit, skill);
  const maxed = current === MAX_SKILL_LEVEL;
  return {
    ...c,
    skills: current === null ? c.skills : { ...c.skills, [skill]: current },
    advancement: {
      ...c.advancement,
      skillPoints: c.advancement.skillPoints + (maxed ? credit : 0),
      skillCredit: credit > 0 && !maxed ? { ...others, [skill]: credit } : others,
    },
  };
}

export const boostsTaken = (c: Character) =>
  (Object.values(c.attributes.advancement) as number[]).reduce((a, b) => a + b, 0);

/** Adds 1 to an attribute; the nth boost costs n points, and a score stays at 18 or below. */
export function boostAttribute(data: GameData, c: Character, attribute: Attribute): TrainResult {
  if (finalScores(c)[attribute] >= MAX_SCORE) return no(`${attribute} is already ${MAX_SCORE}`);
  const cost = attributeBoostCost(boostsTaken(c), level(data, c));
  if (!cost.ok) {
    return no(
      cost.reason === 'at-maximum'
        ? 'five boosts is the most anyone can buy'
        : 'the next boost needs a higher character level',
    );
  }
  const paid = pay(c, cost.cost, true);
  if (!paid) return no(`that costs ${cost.cost} skill points`);
  const adv = paid.attributes.advancement;
  return {
    ok: true,
    character: {
      ...paid,
      attributes: {
        ...paid.attributes,
        advancement: { ...adv, [attribute]: (adv[attribute] ?? 0) + 1 },
      },
    },
  };
}

/** Chooses which known spells are prepared, up to the class's limit. */
export function prepareSpells(data: GameData, c: Character, prepared: string[]): TrainResult {
  const magic = characterSheet(c, data).magic;
  if (!magic) return no(`${c.name} casts no spells`);
  if (prepared.some((id) => !c.spells.known.includes(id))) return no('prepare only known spells');
  if (new Set(prepared).size !== prepared.length) return no('prepare each spell once');
  if (prepared.length > magic.slots.spellsPrepared)
    return no(`${c.name} can prepare ${magic.slots.spellsPrepared} spells`);
  return { ok: true, character: { ...c, spells: { ...c.spells, prepared } } };
}

/** Switches the class new levels go into; town only, after 4th level in the current class. */
export function changeClass(data: GameData, c: Character, target: string): TrainResult {
  const known = (id: string) => !!classOption(data, id) && !!findProgression(data, id);
  const result = switchClass(c.classes, target, true, known);
  if (result.ok) return { ok: true, character: { ...c, classes: result.classes } };
  const reasons = {
    'unknown-class': `${target} isn't a class in this version`,
    'same-class': `${c.name} is already in that class`,
    'current-below-4': 'switching needs 4th level in the current class',
    'not-in-town': 'classes change only in town',
  } as const;
  return no(reasons[result.reason]);
}
