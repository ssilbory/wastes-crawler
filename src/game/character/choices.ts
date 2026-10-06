// The character creation choices and their evaluated result.
import type { AttributeScores, ModifierBonuses } from '../../rules/attributes.ts';
import type { Adjustments, AttributeMethod } from './attributes.ts';
import type { ChosenBackground } from './background.ts';
import type { EquipmentSummary } from './equipment.ts';
import type { FocusChoice, FocusSlot, HeldFocus } from './foci.ts';
import type { GearChoice } from './gear.ts';
import type { InventoryEntry } from './items.ts';
import type { MagicChoice, MagicOutcome } from './magic.ts';
import type { Skills } from './skills.ts';
import type { Step, StepStatus } from './steps.ts';

export const MAX_NAME = 60;
export const MAX_GOAL = 200;

export interface Choices {
  /** Empty until chosen. */
  people: string;
  /** Required when the people has lineages. */
  lineage: string | null;
  /** The base scores, before the people and background, once all six are set. */
  array: AttributeScores | null;
  /** How they were made: the standard array unless rolled or named (Phase 16). */
  attributeMethod: AttributeMethod;
  background: ChosenBackground | null;
  classId: string | null;
  /** Replacements for class bonus skills that are already level-1, by position. */
  classSkills: (string | null)[];
  /** One entry per focus slot; signature slots may stay null. */
  foci: (FocusChoice | null)[];
  /** Arts and starting spells, for Mage classes. */
  magic: MagicChoice | null;
  freeSkill: string | null;
  gear: GearChoice | null;
  name: string;
  goal: string;
}

export interface Evaluation {
  /** Final scores after the people and background, or null until the people and array are set. */
  scores: AttributeScores | null;
  peopleAdjust: Adjustments;
  backgroundAdjust: Adjustments;
  skills: Skills;
  /** Racial slots once the people is valid, plus class slots once the class is. */
  focusSlots: FocusSlot[];
  /** Skills before each focus slot that was evaluated. */
  focusSkillsBefore: Skills[];
  /** The class bonus skills, by position, that need a replacement skill; null where none. */
  classReplacing: (string | null)[];
  foci: HeldFocus[];
  modifierBonuses: ModifierBonuses;
  inventory: InventoryEntry[];
  /** Money left after starting gear, in tenths of a crown. */
  crownsTenths: number;
  /** AC, attacks, and load once the people and scores are known. */
  equipment: EquipmentSummary | null;
  /** Arts, known spells, and prepared spells (empty for non-casters). */
  magic: MagicOutcome;
  /** Effort maximum for casters once scores and class are known. */
  effort: number | null;
  steps: Record<Step, StepStatus>;
  complete: boolean;
}

export function emptyChoices(): Choices {
  return {
    people: '',
    lineage: null,
    array: null,
    attributeMethod: { kind: 'array' },
    background: null,
    classId: null,
    classSkills: [],
    foci: [],
    magic: null,
    freeSkill: null,
    gear: null,
    name: '',
    goal: '',
  };
}
