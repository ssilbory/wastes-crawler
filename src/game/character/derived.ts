import type { Attribute, Character, People } from '../../data/schemas/index.ts';
import {
  boostedModifier,
  type AttributeScores,
  type ModifierBonuses,
} from '../../rules/attributes.ts';
import { characterLevel, progressionRow, totalAttackBonus } from '../../rules/progression.ts';
import { pcSaveTarget, type SaveType } from '../../rules/saves.ts';
import { addAdjustments, ATTRIBUTES } from './attributes.ts';
import { findProgression, progressionLookup, type GameData } from './context.ts';
import type { Evaluation } from './creation.ts';
import { modifierBonuses } from './foci.ts';
import { findPeople } from './people.ts';

export interface Sheet {
  scores: AttributeScores;
  modifiers: Record<Attribute, number>;
  level: number;
  attackBonus: number;
  saves: Record<SaveType, number>;
  /** System Strain maximum: the Constitution score. */
  strainMax: number;
  size: People['size'];
}

export function finalScores(c: Character): AttributeScores {
  return addAdjustments(
    addAdjustments(c.attributes.base, c.attributes.people),
    c.attributes.background,
  );
}

const SAVES: readonly SaveType[] = ['physical', 'evasion', 'mental', 'luck'];

/** Modifiers and save targets, with focus bonuses such as Developed Attribute applied. */
function modifiersAndSaves(scores: AttributeScores, level: number, bonuses: ModifierBonuses) {
  return {
    modifiers: Object.fromEntries(
      ATTRIBUTES.map((a) => [a, boostedModifier(scores[a], bonuses[a])]),
    ) as Record<Attribute, number>,
    saves: Object.fromEntries(
      SAVES.map((t) => [t, pcSaveTarget(level, scores, t, bonuses)]),
    ) as Record<SaveType, number>,
  };
}

export function characterSheet(c: Character, data: GameData): Sheet {
  const people = findPeople(data, c.people);
  if (!people) throw new Error(`unknown people ${c.people}`);
  const scores = finalScores(c);
  const level = characterLevel(c.classes);
  return {
    scores,
    ...modifiersAndSaves(scores, level, modifierBonuses(c.foci)),
    level,
    attackBonus: totalAttackBonus(c.classes, progressionLookup(data)),
    strainMax: scores.con,
    size: people.size,
  };
}

export interface Preview {
  scores: AttributeScores | null;
  modifiers: Record<Attribute, number> | null;
  /** Null until a valid class is chosen. */
  attackBonus: number | null;
  /** Null until scores exist. */
  saves: Record<SaveType, number> | null;
}

/** The live sheet for an unfinished character at 1st level. */
export function previewSheet(ev: Evaluation, classId: string | null, data: GameData): Preview {
  const scores = ev.scores;
  const progression =
    classId !== null && ev.steps.class.state === 'ok' ? findProgression(data, classId) : undefined;
  const derived = scores ? modifiersAndSaves(scores, 1, ev.modifierBonuses) : null;
  return {
    scores,
    modifiers: derived?.modifiers ?? null,
    attackBonus: progression ? progressionRow(progression, 1).attackBonus : null,
    saves: derived?.saves ?? null,
  };
}
