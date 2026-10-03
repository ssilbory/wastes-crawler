// vendor/wwn-srd/1.0 Character Creation/1.3.0 Backgrounds.md (1.3.2) and 1.2.0 Skills.md (1.2.2).
import type { GrowthEntry, LearningEntry } from '../../data/schemas/index.ts';
import type { AttributeScores } from '../../rules/attributes.ts';
import type { Rng } from '../../rules/rng.ts';
import { addAdjustments, checkAttributeBonus, type Adjustments } from './attributes.ts';
import { isSkill, type GameData } from './context.ts';
import { backgroundOpenTo } from './people.ts';
import { addCreationSkill, COMBAT_SKILLS, type Skills } from './skills.ts';
import { fail, INCOMPLETE, OK, type StepStatus } from './steps.ts';

export const BACKGROUND_PICKS = 2;
export const BACKGROUND_ROLLS = 3;

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

export interface ChosenBackground {
  id: string;
  choice: BackgroundChoice;
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

export interface BackgroundOutcome {
  status: StepStatus;
  skills: Skills;
  adjust: Adjustments;
}

export function evaluateBackground(
  data: GameData,
  chosen: ChosenBackground | null,
  peopleId: string,
  scores: AttributeScores,
): BackgroundOutcome {
  if (!chosen) return { status: INCOMPLETE, skills: {}, adjust: {} };
  const bg = data.content.backgrounds.find((b) => b.id === chosen.id);
  if (!bg) return { status: fail(`unknown background ${chosen.id}`), skills: {}, adjust: {} };
  if (!backgroundOpenTo(bg, peopleId)) {
    return { status: fail(`${bg.name} isn't open to ${peopleId}`), skills: {}, adjust: {} };
  }

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
