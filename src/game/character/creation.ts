// The SRD 1.0 character creation steps (vendor/wwn-srd/1.0 Character Creation/), limited to the
// Phase 3a scope: Goblins, the standard array, a background, a fighting class, and a free skill.
import {
  CHARACTER_SCHEMA_VERSION,
  CharacterSchema,
  type Character,
  type GrowthEntry,
  type LearningEntry,
  type Progression,
} from '../../data/schemas/index.ts';
import { attributeModifier, type AttributeScores } from '../../rules/attributes.ts';
import { rollMaxHp } from '../../rules/hit-points.ts';
import { levelHitDie, startingClass } from '../../rules/progression.ts';
import type { Rng } from '../../rules/rng.ts';
import {
  addAdjustments,
  applyPeople,
  checkAttributeBonus,
  isStandardArray,
  type Adjustments,
} from './attributes.ts';
import { findProgression, isSkill, type GameData } from './context.ts';
import { addCreationSkill, COMBAT_SKILLS, type Skills } from './skills.ts';

/** Warrior, Expert, and the Adventurer's Partial Warrior/Partial Expert. */
export const STARTING_CLASSES = ['full-warrior', 'full-expert', 'partial-expert-partial-warrior'];
export const BACKGROUND_PICKS = 2;
export const BACKGROUND_ROLLS = 3;
export const MAX_NAME = 60;
export const MAX_GOAL = 200;

/** A Learning entry picked by the player; `skill` resolves "Any Combat" or substitutes a level-1 skill. */
export interface PickedEntry {
  index: number;
  skill?: string;
}

/** A rolled entry; `skill` resolves "Any" entries or substitutes, `allocation` places a stat bonus. */
export interface RolledEntry {
  table: 'growth' | 'learning';
  index: number;
  skill?: string;
  allocation?: Adjustments;
}

export type BackgroundChoice =
  { mode: 'pick'; picks: PickedEntry[] } | { mode: 'roll'; rolls: RolledEntry[] };

export interface Choices {
  people: string;
  array: AttributeScores | null;
  background: { id: string; choice: BackgroundChoice } | null;
  classId: string | null;
  freeSkill: string | null;
  name: string;
  goal: string;
}

export type Step = 'attributes' | 'background' | 'class' | 'free-skill' | 'identity';
export type StepStatus =
  { state: 'incomplete' } | { state: 'ok' } | { state: 'error'; message: string };

export interface Evaluation {
  /** Final scores after the people and background, or null until the array is assigned. */
  scores: AttributeScores | null;
  peopleAdjust: Adjustments;
  backgroundAdjust: Adjustments;
  skills: Skills;
  steps: Record<Step, StepStatus>;
  complete: boolean;
}

const OK: StepStatus = { state: 'ok' };
const INCOMPLETE: StepStatus = { state: 'incomplete' };
const fail = (message: string): StepStatus => ({ state: 'error', message });

export function emptyChoices(people = 'goblin'): Choices {
  return {
    people,
    array: null,
    background: null,
    classId: null,
    freeSkill: null,
    name: '',
    goal: '',
  };
}

/** Three rolls split between the d6 Growth and d8 Learning tables as the player chooses. */
export function rollBackground(
  rng: Rng,
  tables: readonly ('growth' | 'learning')[],
): RolledEntry[] {
  if (tables.length !== BACKGROUND_ROLLS) throw new Error(`expected ${BACKGROUND_ROLLS} rolls`);
  return tables.map((table) => ({ table, index: rng.int(1, table === 'growth' ? 6 : 8) - 1 }));
}

type Gain = { skills: Skills } | { error: StepStatus };

function gainSkill(
  data: GameData,
  skills: Skills,
  entry: LearningEntry | GrowthEntry,
  chosen: string | undefined,
): Gain {
  let target: string;
  if (entry.kind === 'skill') {
    target = entry.skill;
    if (chosen !== undefined && chosen !== entry.skill) {
      if (skills[entry.skill] !== 1)
        return { error: fail(`${chosen} can only replace ${entry.skill} once it is level-1`) };
      target = chosen;
    }
  } else if (chosen === undefined) {
    return { error: INCOMPLETE };
  } else if (entry.kind === 'any-combat' && !COMBAT_SKILLS.includes(chosen)) {
    return { error: fail(`${chosen} isn't a combat skill`) };
  } else {
    target = chosen;
  }
  if (!isSkill(data, target)) return { error: fail(`unknown skill ${target}`) };
  const next = addCreationSkill(skills, target);
  if (next === 'already-level-1')
    return { error: fail(`${target} is already level-1; choose another skill`) };
  return { skills: next };
}

interface BackgroundOutcome {
  status: StepStatus;
  skills: Skills;
  adjust: Adjustments;
}

function evaluateBackground(
  data: GameData,
  choices: Choices,
  scores: AttributeScores,
): BackgroundOutcome {
  const chosen = choices.background;
  if (!chosen) return { status: INCOMPLETE, skills: {}, adjust: {} };
  const bg = data.content.backgrounds.find((b) => b.id === chosen.id);
  if (!bg) return { status: fail(`unknown background ${chosen.id}`), skills: {}, adjust: {} };

  let skills = addCreationSkill({}, bg.freeSkill) as Skills;
  let current = scores;
  const adjust: Adjustments = {};
  const steps =
    chosen.choice.mode === 'pick'
      ? chosen.choice.picks.map((p) => ({
          entry: bg.learning[p.index],
          skill: p.skill,
          allocation: undefined,
        }))
      : chosen.choice.rolls.map((r) => ({
          entry: (r.table === 'growth' ? bg.growth : bg.learning)[r.index],
          skill: r.skill,
          allocation: r.allocation,
        }));
  const needed = chosen.choice.mode === 'pick' ? BACKGROUND_PICKS : BACKGROUND_ROLLS;
  if (steps.length > needed) return { status: fail(`expected ${needed} entries`), skills, adjust };

  for (const step of steps) {
    if (!step.entry) return { status: fail('no such background table entry'), skills, adjust };
    if (step.entry.kind === 'attribute') {
      if (!step.allocation) return { status: INCOMPLETE, skills, adjust };
      const error = checkAttributeBonus(
        current,
        step.entry.amount,
        step.entry.pool,
        step.allocation,
      );
      if (error) return { status: fail(`attribute bonus: ${error}`), skills, adjust };
      current = addAdjustments(current, step.allocation);
      for (const [a, v] of Object.entries(step.allocation)) {
        adjust[a as keyof Adjustments] = (adjust[a as keyof Adjustments] ?? 0) + v;
      }
      continue;
    }
    const gain = gainSkill(data, skills, step.entry, step.skill);
    if ('error' in gain) return { status: gain.error, skills, adjust };
    skills = gain.skills;
  }
  return { status: steps.length < needed ? INCOMPLETE : OK, skills, adjust };
}

export function evaluateChoices(choices: Choices, data: GameData): Evaluation {
  const steps: Record<Step, StepStatus> = {
    attributes: INCOMPLETE,
    background: INCOMPLETE,
    class: INCOMPLETE,
    'free-skill': INCOMPLETE,
    identity: INCOMPLETE,
  };
  let scores: AttributeScores | null = null;
  let peopleAdjust: Adjustments = {};
  let backgroundAdjust: Adjustments = {};
  let skills: Skills = {};

  const people = data.content.peoples.find((p) => p.id === choices.people);
  if (!people) steps.attributes = fail(`unknown people ${choices.people}`);
  else if (choices.array && !isStandardArray(choices.array)) {
    steps.attributes = fail('scores must be 14, 12, 11, 10, 9, and 7, one each');
  } else if (choices.array) {
    const applied = applyPeople(choices.array, people);
    scores = applied.scores;
    peopleAdjust = applied.applied;
    steps.attributes = OK;
  }

  if (scores) {
    const bg = evaluateBackground(data, choices, scores);
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

  const name = choices.name.trim();
  if (name.length > MAX_NAME) steps.identity = fail(`name is longer than ${MAX_NAME} characters`);
  else if (choices.goal.length > MAX_GOAL)
    steps.identity = fail(`goal is longer than ${MAX_GOAL} characters`);
  else if (name !== '') steps.identity = OK;

  const complete = Object.values(steps).every((s) => s.state === 'ok');
  return { scores, peopleAdjust, backgroundAdjust, skills, steps, complete };
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
  const background = choices.background as NonNullable<Choices['background']>;
  const progression = findProgression(data, choices.classId as string) as Progression;
  const hp = rollMaxHp(rng, {
    dice: [levelHitDie(progression, 1)],
    conModifier: attributeModifier(scores.con),
    dieHard: false,
    currentMax: 0,
  }).max;
  const hex = () => rng.int(0, 0xffff_ffff).toString(16).padStart(8, '0');
  const character = CharacterSchema.parse({
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    id: `char-${hex()}${hex()}`,
    name: choices.name.trim(),
    goal: choices.goal,
    people: choices.people,
    background: background.id,
    attributes: { base: array, people: ev.peopleAdjust, background: ev.backgroundAdjust },
    skills: ev.skills,
    classes: startingClass(progression.id),
    hp: { max: hp, current: hp },
    xp: 0,
    strain: { value: 0, broken: false },
  });
  return { ok: true, character };
}
