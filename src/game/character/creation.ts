// The SRD 1.0 character creation steps (vendor/wwn-srd/1.0 Character Creation/), limited to the
// Phase 3 scope so far: the setting's peoples, the standard array, a background, a fighting class,
// and a free skill.
import {
  CHARACTER_SCHEMA_VERSION,
  CharacterSchema,
  type Character,
  type People,
  type Progression,
} from '../../data/schemas/index.ts';
import {
  boostedModifier,
  type AttributeScores,
  type ModifierBonuses,
} from '../../rules/attributes.ts';
import { rollMaxHp } from '../../rules/hit-points.ts';
import { levelHitDie, progressionRow, startingClass } from '../../rules/progression.ts';
import type { Rng } from '../../rules/rng.ts';
import {
  addAdjustments,
  applyPeopleModifiers,
  isStandardArray,
  type Adjustments,
} from './attributes.ts';
import { evaluateBackground, type ChosenBackground } from './background.ts';
import {
  evaluateFoci,
  focusSlots,
  hasDieHard,
  type FocusChoice,
  type FocusSlot,
  type HeldFocus,
} from './foci.ts';
import { findProgression, isSkill, type GameData } from './context.ts';
import { loadoutSummary, type EquipmentSummary } from './equipment.ts';
import { evaluateGear, type GearChoice } from './gear.ts';
import type { InventoryEntry } from './items.ts';
import { evaluatePeople, findLineage, findPeople } from './people.ts';
import { addCreationSkill, type Skills } from './skills.ts';
import { fail, INCOMPLETE, OK, type Step, type StepStatus } from './steps.ts';

export {
  BACKGROUND_PICKS,
  BACKGROUND_ROLLS,
  rollBackground,
  type BackgroundChoice,
  type ChosenBackground,
  type PickedEntry,
  type RolledEntry,
} from './background.ts';
export type { Step, StepStatus } from './steps.ts';
export type { FocusChoice, FocusSlot, HeldFocus } from './foci.ts';
export type { GearChoice } from './gear.ts';

/** Warrior, Expert, and the Adventurer's Partial Warrior/Partial Expert. */
export const STARTING_CLASSES = ['full-warrior', 'full-expert', 'partial-expert-partial-warrior'];
export const MAX_NAME = 60;
export const MAX_GOAL = 200;

export interface Choices {
  /** Empty until chosen. */
  people: string;
  /** Required when the people has lineages. */
  lineage: string | null;
  array: AttributeScores | null;
  background: ChosenBackground | null;
  classId: string | null;
  /** One entry per focus slot; signature slots may stay null. */
  foci: (FocusChoice | null)[];
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
  foci: HeldFocus[];
  modifierBonuses: ModifierBonuses;
  inventory: InventoryEntry[];
  /** Money left after starting gear, in tenths of a crown. */
  crownsTenths: number;
  /** AC, attacks, and load once the people and scores are known. */
  equipment: EquipmentSummary | null;
  steps: Record<Step, StepStatus>;
  complete: boolean;
}

export function emptyChoices(): Choices {
  return {
    people: '',
    lineage: null,
    array: null,
    background: null,
    classId: null,
    foci: [],
    freeSkill: null,
    gear: null,
    name: '',
    goal: '',
  };
}

export function evaluateChoices(choices: Choices, data: GameData): Evaluation {
  const steps: Record<Step, StepStatus> = {
    people: INCOMPLETE,
    attributes: INCOMPLETE,
    background: INCOMPLETE,
    class: INCOMPLETE,
    foci: INCOMPLETE,
    'free-skill': INCOMPLETE,
    gear: INCOMPLETE,
    identity: INCOMPLETE,
  };
  let scores: AttributeScores | null = null;
  let peopleAdjust: Adjustments = {};
  let backgroundAdjust: Adjustments = {};
  let skills: Skills = {};
  let slots: FocusSlot[] = [];
  let foci: HeldFocus[] = [];
  let focusSkillsBefore: Skills[] = [];
  let modifierBonuses: ModifierBonuses = {};
  let inventory: InventoryEntry[] = [];
  let crownsTenths = 0;
  let equipment: EquipmentSummary | null = null;

  const peopleOutcome = evaluatePeople(data, choices.people, choices.lineage);
  const peopleStatus = peopleOutcome.status;
  steps.people = peopleStatus;
  if (choices.array && !isStandardArray(choices.array)) {
    steps.attributes = fail('scores must be 14, 12, 11, 10, 9, and 7, one each');
  } else if (choices.array) {
    steps.attributes = OK;
    // Final scores need the people's modifiers, so they wait for a valid people and lineage.
    if (peopleOutcome.modifiers) {
      const applied = applyPeopleModifiers(choices.array, peopleOutcome.modifiers);
      scores = applied.scores;
      peopleAdjust = applied.applied;
    }
  }

  if (scores) {
    const bg = evaluateBackground(data, choices.background, choices.people, scores);
    steps.background = bg.status;
    skills = bg.skills;
    backgroundAdjust = bg.adjust;
    scores = addAdjustments(scores, backgroundAdjust);
  }

  if (choices.classId !== null) {
    const known =
      STARTING_CLASSES.includes(choices.classId) && findProgression(data, choices.classId);
    steps.class = known ? OK : fail(`${choices.classId} isn't a starting class in this version`);
  }

  if (peopleStatus.state === 'ok') {
    // A valid people step guarantees the people exists.
    const people = findPeople(data, choices.people) as People;
    const lineage = choices.lineage === null ? undefined : findLineage(people, choices.lineage);
    const progression =
      steps.class.state === 'ok' ? findProgression(data, choices.classId as string) : undefined;
    slots = focusSlots(people, lineage, progression);
    if (progression && steps.background.state === 'ok') {
      const outcome = evaluateFoci(data, slots, choices.foci, skills);
      steps.foci = outcome.status;
      skills = outcome.skills;
      foci = outcome.foci;
      focusSkillsBefore = outcome.skillsBefore;
      modifierBonuses = outcome.bonuses;
    }
  }

  if (choices.freeSkill !== null) {
    const next = isSkill(data, choices.freeSkill)
      ? addCreationSkill(skills, choices.freeSkill)
      : null;
    if (next === null) steps['free-skill'] = fail(`unknown skill ${choices.freeSkill}`);
    else if (next === 'already-level-1')
      steps['free-skill'] = fail(`${choices.freeSkill} is already level-1`);
    else {
      skills = next;
      steps['free-skill'] = OK;
    }
  }

  if (peopleStatus.state === 'ok' && scores) {
    const progression =
      steps.class.state === 'ok' ? findProgression(data, choices.classId as string) : undefined;
    const loadout = {
      people: findPeople(data, choices.people) as People,
      scores,
      bonuses: modifierBonuses,
      skills,
      foci,
      level: 1,
      attackBonus: progression ? progressionRow(progression, 1).attackBonus : 0,
    };
    const gear = evaluateGear(data, choices.gear, loadout);
    steps.gear = gear.status;
    inventory = gear.inventory;
    crownsTenths = gear.tenths;
    equipment = loadoutSummary(data, { ...loadout, entries: inventory });
  }

  const name = choices.name.trim();
  if (name.length > MAX_NAME) steps.identity = fail(`name is longer than ${MAX_NAME} characters`);
  else if (choices.goal.length > MAX_GOAL)
    steps.identity = fail(`goal is longer than ${MAX_GOAL} characters`);
  else if (name !== '') steps.identity = OK;

  const complete = Object.values(steps).every((s) => s.state === 'ok');
  return {
    scores,
    peopleAdjust,
    backgroundAdjust,
    skills,
    focusSlots: slots,
    focusSkillsBefore,
    foci,
    modifierBonuses,
    inventory,
    crownsTenths,
    equipment,
    steps,
    complete,
  };
}

export type FinishResult = { ok: true; character: Character } | { ok: false; errors: string[] };

/** Rolls starting HP (SRD 1.7.1) and assembles a saved character from complete choices. */
export function finishCharacter(choices: Choices, data: GameData, rng: Rng): FinishResult {
  const ev = evaluateChoices(choices, data);
  if (!ev.complete) {
    const errors = Object.entries(ev.steps)
      .filter(([, s]) => s.state !== 'ok')
      .map(([step, s]) => `${step}: ${s.state === 'error' ? s.message : 'incomplete'}`);
    return { ok: false, errors };
  }
  // A complete evaluation guarantees the array, background, class, and final scores exist.
  const scores = ev.scores as AttributeScores;
  const array = choices.array as AttributeScores;
  const background = choices.background as ChosenBackground;
  const progression = findProgression(data, choices.classId as string) as Progression;
  const hp = rollMaxHp(rng, {
    dice: [levelHitDie(progression, 1)],
    conModifier: boostedModifier(scores.con, ev.modifierBonuses.con),
    dieHard: hasDieHard(data, ev.foci),
    currentMax: 0,
  }).max;
  const hex = () => rng.int(0, 0xffff_ffff).toString(16).padStart(8, '0');
  const character = CharacterSchema.parse({
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    id: `char-${hex()}${hex()}`,
    name: choices.name.trim(),
    goal: choices.goal,
    people: choices.people,
    ...(choices.lineage === null ? {} : { lineage: choices.lineage }),
    background: background.id,
    attributes: { base: array, people: ev.peopleAdjust, background: ev.backgroundAdjust },
    foci: ev.foci,
    inventory: ev.inventory,
    crowns: ev.crownsTenths / 10,
    skills: ev.skills,
    classes: startingClass(progression.id),
    hp: { max: hp, current: hp },
    xp: 0,
    strain: { value: 0, broken: false },
  });
  return { ok: true, character };
}
