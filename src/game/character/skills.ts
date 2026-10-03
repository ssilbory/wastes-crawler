// vendor/wwn-srd/1.0 Character Creation/1.2.0 Skills.md (1.2.2 Gaining Skills in Character Creation)

export type Skills = Readonly<Record<string, number>>;

export const COMBAT_SKILLS: readonly string[] = ['stab', 'shoot', 'punch'];

/**
 * The first pick of a skill gives level-0, the second level-1. A further pick is refused: the
 * player must pick some other skill that isn't already level-1, since nobody starts above level-1.
 */
export function addCreationSkill(skills: Skills, skill: string): Skills | 'already-level-1' {
  const current = Object.hasOwn(skills, skill) ? skills[skill] : undefined;
  if (current === undefined) return { ...skills, [skill]: 0 };
  if (current === 0) return { ...skills, [skill]: 1 };
  return 'already-level-1';
}
