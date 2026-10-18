// The SRD 1.0 character creation steps (vendor/wwn-srd/1.0 Character Creation/), limited to the
// Phase 3 scope so far: the setting's peoples, the standard array, a background, a fighting class,
// and a free skill.
import { formProblem } from './forms.ts';
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
  scoresProblem,
  type Adjustments,
} from './attributes.ts';
import { evaluateBackground, type ChosenBackground } from './background.ts';
import { evaluateFoci, focusSlots, hasDieHard, type FocusSlot, type HeldFocus } from './foci.ts';
import { findProgression, isSkill, type GameData } from './context.ts';
import { loadoutSummary, type EquipmentSummary } from './equipment.ts';
import { evaluateClass } from './class-step.ts';
import { evaluateGear } from './gear.ts';
import { effortFor, evaluateMagic, gainsArts, type MagicOutcome } from './magic.ts';
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
export type { MagicChoice } from './magic.ts';
export { emptyChoices, MAX_GOAL, MAX_NAME, type Choices, type Evaluation } from './choices.ts';
import { MAX_GOAL, MAX_NAME, type Choices, type Evaluation } from './choices.ts';

export function evaluateChoices(choices: Choices, data: GameData): Evaluation {
  const steps: Record<Step, StepStatus> = {
    people: INCOMPLETE,
    attributes: INCOMPLETE,
    background: INCOMPLETE,
    class: INCOMPLETE,
    foci: INCOMPLETE,
    magic: INCOMPLETE,
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
  let magic: MagicOutcome = { status: INCOMPLETE, arts: [], known: [], prepared: [] };
  let effort: number | null = null;

  const peopleOutcome = evaluatePeople(data, choices.people, choices.lineage);
  const peopleStatus = peopleOutcome.status;
  steps.people = peopleStatus;
  const problem = choices.array && scoresProblem(choices.attributeMethod, choices.array);
  if (problem) {
    steps.attributes = fail(problem);
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

  const backgroundOk = steps.background.state === 'ok';
  const cls = evaluateClass(
    data,
    choices.classId,
    choices.classSkills,
    backgroundOk ? skills : null,
  );
  steps.class = cls.status;
  const classOk = cls.status.state === 'ok';
  if (backgroundOk && classOk) skills = cls.skills;
  const progression = classOk ? cls.progression : undefined;

  if (peopleStatus.state === 'ok') {
    // A valid people step guarantees the people exists.
    const people = findPeople(data, choices.people) as People;
    const lineage = choices.lineage === null ? undefined : findLineage(people, choices.lineage);
    slots = focusSlots(people, lineage, progression);
    if (progression && backgroundOk) {
      const outcome = evaluateFoci(
        data,
        slots,
        choices.foci,
        skills,
        cls.option?.mage !== undefined,
      );
      steps.foci = outcome.status;
      skills = outcome.skills;
      foci = outcome.foci;
      focusSkillsBefore = outcome.skillsBefore;
      modifierBonuses = outcome.bonuses;
    }
  }

  const intModifier = scores ? boostedModifier(scores.int, modifierBonuses.int) : 0;
  if (classOk) {
    magic = evaluateMagic(data, cls.option?.mage, choices.magic, intModifier);
    steps.magic = magic.status;
    const forms = choices.forms ?? [];
    const who = { name: choices.name.trim() || 'This character', arts: magic.arts };
    const why =
      forms.length > 0 &&
      formProblem(data, { ...who, classes: startingClass(choices.classId as string) }, forms);
    if (why) steps.magic = fail(why);
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

  const mage = cls.option?.mage;
  if (scores && classOk && mage && gainsArts(data, mage)) {
    effort = effortFor(
      data,
      startingClass(choices.classId as string),
      skills,
      scores,
      modifierBonuses,
    );
  }

  if (peopleStatus.state === 'ok' && scores) {
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
    classReplacing: cls.replacing,
    foci,
    modifierBonuses,
    intModifier,
    inventory,
    crownsTenths,
    equipment,
    magic,
    effort,
    steps,
    complete,
  };
}

/** A fresh saved-character id. */
export function newCharacterId(rng: Rng): string {
  const hex = () => rng.int(0, 0xffff_ffff).toString(16).padStart(8, '0');
  return `char-${hex()}${hex()}`;
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
  const character = CharacterSchema.parse({
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    id: newCharacterId(rng),
    name: choices.name.trim(),
    goal: choices.goal,
    people: choices.people,
    ...(choices.lineage === null ? {} : { lineage: choices.lineage }),
    background: background.id,
    attributes: {
      base: array,
      people: ev.peopleAdjust,
      background: ev.backgroundAdjust,
      advancement: {},
    },
    foci: ev.foci,
    arts: ev.magic.arts,
    ...(choices.forms?.length ? { forms: choices.forms } : {}),
    spells: { known: ev.magic.known, prepared: ev.magic.prepared },
    inventory: ev.inventory,
    crowns: ev.crownsTenths / 10,
    skills: ev.skills,
    classes: startingClass(choices.classId as string),
    hp: { max: hp, current: hp },
    xp: 0,
    advancement: { skillPoints: 0, quickPoints: 0, skillCredit: {} },
    strain: { value: 0, broken: false },
  });
  return { ok: true, character };
}
