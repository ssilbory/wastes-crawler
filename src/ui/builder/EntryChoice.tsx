import type { GrowthEntry, LearningEntry } from '../../data/schemas/index.ts';
import { COMBAT_SKILLS, type Skills } from '../../game/character/skills.ts';
import { skillName, skills } from './data.ts';
import { Select } from './Field.tsx';

const combatOptions = COMBAT_SKILLS.map((id) => ({ value: id, label: skillName(id) }));
const skillOptions = skills.map((s) => ({ value: s.id, label: s.name }));

/**
 * The extra skill choice a background entry may need (SRD 1.2.2, 1.3.2): which combat skill for
 * "Any Combat", which skill for "Any Skill", or a replacement when the named skill is already
 * level-1. `prior` is the skill set before this entry is applied.
 */
export function EntrySkillChoice(props: {
  label: string;
  entry: GrowthEntry | LearningEntry;
  prior: Skills;
  value: string | undefined;
  onChange: (skill: string | undefined) => void;
}) {
  const { entry } = props;
  const set = (v: string) => props.onChange(v === '' ? undefined : v);
  if (entry.kind === 'any-combat') {
    return (
      <Select
        label={`Combat skill for ${props.label}`}
        value={props.value ?? ''}
        options={combatOptions}
        onChange={set}
      />
    );
  }
  if (entry.kind === 'any-skill') {
    return (
      <Select
        label={`Skill for ${props.label}`}
        value={props.value ?? ''}
        options={skillOptions}
        onChange={set}
      />
    );
  }
  if (entry.kind === 'skill' && props.prior[entry.skill] === 1) {
    return (
      <Select
        label={`Replacement for ${props.label}`}
        value={props.value ?? ''}
        options={skillOptions.filter((o) => o.value !== entry.skill)}
        placeholder={`${skillName(entry.skill)} is already level-1; choose another`}
        onChange={set}
      />
    );
  }
  return null;
}
