import type { Attribute, Character } from '../../data/schemas/index.ts';
import { attributeModifier, type AttributeScores } from '../../rules/attributes.ts';
import { characterLevel, progressionRow, totalAttackBonus } from '../../rules/progression.ts';
import { pcSaveTarget, type SaveType } from '../../rules/saves.ts';
import { addAdjustments, ATTRIBUTES } from './attributes.ts';
import { findProgression, progressionLookup, type GameData } from './context.ts';
import type { Evaluation } from './creation.ts';

export interface Sheet {
  scores: AttributeScores;
  modifiers: Record<Attribute, number>;
  level: number;
  attackBonus: number;
  saves: Record<SaveType, number>;
  /** System Strain maximum: the Constitution score. */
  strainMax: number;
}

export function finalScores(c: Character): AttributeScores {
  return addAdjustments(
    addAdjustments(c.attributes.base, c.attributes.people),
    c.attributes.background,
  );
}

export function characterSheet(c: Character, data: GameData): Sheet {
  const scores = finalScores(c);
  const level = characterLevel(c.classes);
  const save = (t: SaveType) => pcSaveTarget(level, scores, t);
  return {
    scores,
    modifiers: Object.fromEntries(
      ATTRIBUTES.map((a) => [a, attributeModifier(scores[a])]),
    ) as Record<Attribute, number>,
    level,
    attackBonus: totalAttackBonus(c.classes, progressionLookup(data)),
    saves: {
      physical: save('physical'),
      evasion: save('evasion'),
      mental: save('mental'),
      luck: save('luck'),
    },
    strainMax: scores.con,
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
  return {
    scores,
    modifiers: scores
      ? (Object.fromEntries(ATTRIBUTES.map((a) => [a, attributeModifier(scores[a])])) as Record<
          Attribute,
          number
        >)
      : null,
    attackBonus: progression ? progressionRow(progression, 1).attackBonus : null,
    saves: scores
      ? {
          physical: pcSaveTarget(1, scores, 'physical'),
          evasion: pcSaveTarget(1, scores, 'evasion'),
          mental: pcSaveTarget(1, scores, 'mental'),
          luck: pcSaveTarget(1, scores, 'luck'),
        }
      : null,
  };
}
