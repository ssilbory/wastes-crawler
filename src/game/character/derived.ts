import type { Attribute, Character } from '../../data/schemas/index.ts';
import { attributeModifier, type AttributeScores } from '../../rules/attributes.ts';
import { characterLevel, totalAttackBonus } from '../../rules/progression.ts';
import { pcSaveTarget, type SaveType } from '../../rules/saves.ts';
import { addAdjustments, ATTRIBUTES } from './attributes.ts';
import { progressionLookup, type GameData } from './context.ts';

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
