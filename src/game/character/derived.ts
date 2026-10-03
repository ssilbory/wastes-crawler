import type { Attribute, Character, People } from '../../data/schemas/index.ts';
import {
  boostedModifier,
  type AttributeScores,
  type ModifierBonuses,
} from '../../rules/attributes.ts';
import {
  characterLevel,
  progressionRow,
  totalAttackBonus,
  type CastingLevelRow,
} from '../../rules/progression.ts';
import { pcSaveTarget, type SaveType } from '../../rules/saves.ts';
import { addAdjustments, ATTRIBUTES } from './attributes.ts';
import { findProgression, progressionLookup, type GameData } from './context.ts';
import type { Evaluation } from './creation.ts';
import { loadoutSummary, type EquipmentSummary } from './equipment.ts';
import { classOption } from './class-step.ts';
import { modifierBonuses } from './foci.ts';
import { castingAllowed, effortFor, spellSlots } from './magic.ts';
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
  equipment: EquipmentSummary;
  /** Null for characters with no casting class. */
  magic: SheetMagic | null;
}

export interface SheetMagic {
  effort: number;
  /** Spell slots of the first casting class held, at that class's level. */
  slots: CastingLevelRow;
  /** False while worn armor or a shield blocks casting. */
  canCast: boolean;
}

function sheetMagic(
  data: GameData,
  c: Character,
  scores: AttributeScores,
  bonuses: ModifierBonuses,
): SheetMagic | null {
  const effort = effortFor(data, c.classes, c.skills, scores, bonuses);
  const caster = Object.entries(c.classes.levels).find(
    ([id, level]) => level >= 1 && classOption(data, id)?.mage,
  );
  const mage = caster ? classOption(data, caster[0])?.mage : undefined;
  if (effort === null || !caster || !mage) return null;
  return {
    effort,
    slots: spellSlots(data, mage, caster[1]),
    canCast: castingAllowed(data, c.inventory, c.foci),
  };
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
  const bonuses = modifierBonuses(c.foci);
  const attackBonus = totalAttackBonus(c.classes, progressionLookup(data));
  return {
    scores,
    ...modifiersAndSaves(scores, level, bonuses),
    level,
    attackBonus,
    equipment: loadoutSummary(data, {
      entries: c.inventory,
      people,
      scores,
      bonuses,
      skills: c.skills,
      foci: c.foci,
      level,
      attackBonus,
    }),
    strainMax: scores.con,
    size: people.size,
    magic: sheetMagic(data, c, scores, bonuses),
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
