// SRD 1.4.0 classes (limited to the class options in data/content), and the Mage traditions'
// bonus Magic skill (1.5.10, 1.5.7), counted as a creation skill pick under 1.2.2.
import type { ClassOption, Progression, Tradition } from '../../data/schemas/index.ts';
import { findProgression, isSkill, type GameData } from './context.ts';
import { addCreationSkill, type Skills } from './skills.ts';
import { fail, INCOMPLETE, OK, type StepStatus } from './steps.ts';

export function classOption(data: GameData, id: string): ClassOption | undefined {
  return data.content.classOptions.find((c) => c.id === id);
}

export function findTradition(data: GameData, id: string): Tradition | undefined {
  return data.content.traditions.find((t) => t.id === id);
}

/** The bonus skill each of a class's traditions grants: Magic, twice for a dual caster. */
export function classBonusSkills(data: GameData, option: ClassOption): string[] {
  return (option.mage?.traditions ?? []).flatMap((t) => {
    const tradition = findTradition(data, t.tradition);
    return tradition ? [tradition.bonusSkill] : [];
  });
}

export interface ClassOutcome {
  status: StepStatus;
  progression: Progression | undefined;
  option: ClassOption | undefined;
  skills: Skills;
  /** Each bonus skill, by position, that lands on a skill already at level-1; null where none. */
  replacing: (string | null)[];
}

/**
 * Checks the class, then applies its bonus skills once `skills` (from the background) is known.
 * A bonus skill already at level-1 needs a replacement from `replacements`, matched by position.
 */
export function evaluateClass(
  data: GameData,
  classId: string | null,
  replacements: readonly (string | null)[],
  skills: Skills | null,
): ClassOutcome {
  const none = { progression: undefined, option: undefined, skills: skills ?? {}, replacing: [] };
  if (classId === null) return { status: INCOMPLETE, ...none };
  const option = classOption(data, classId);
  const progression = option ? findProgression(data, classId) : undefined;
  if (!option || !progression) {
    return { status: fail(`${classId} isn't a starting class in this version`), ...none };
  }
  if (!skills) return { status: OK, progression, option, skills: {}, replacing: [] };
  let next = skills;
  let status = OK;
  const replacing: (string | null)[] = [];
  // Every bonus skill is tried, so each one needing a replacement is known at once.
  for (const [i, skill] of classBonusSkills(data, option).entries()) {
    const direct = addCreationSkill(next, skill);
    replacing.push(direct === 'already-level-1' ? skill : null);
    if (direct !== 'already-level-1') {
      next = direct;
      continue;
    }
    const replacement = replacements[i] ?? null;
    const gained =
      replacement !== null && isSkill(data, replacement)
        ? addCreationSkill(next, replacement)
        : 'already-level-1';
    if (gained !== 'already-level-1') next = gained;
    else if (status === OK)
      status = fail(
        replacement === null
          ? `${skill} is already level-1; choose a replacement`
          : `can't replace ${skill} with ${replacement}`,
      );
  }
  return { status, progression, option, skills: next, replacing };
}
