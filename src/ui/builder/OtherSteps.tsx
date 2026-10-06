import { MAX_GOAL, MAX_NAME, type StepStatus } from '../../game/character/creation.ts';
import { classes, skillName, skills } from './data.ts';
import { Select, Step } from './Field.tsx';

/** Warrior, Expert, Mage, or the named partial classes (SRD 1.4.0), from data/content. */
export function ClassStep(props: {
  value: string | null;
  status: StepStatus;
  /** Each class bonus skill, by position, to replace when it's already level-1; null where not. */
  replacing: readonly (string | null)[];
  replacements: readonly (string | null)[];
  onChange: (id: string | null) => void;
  onReplace: (index: number, skill: string | null) => void;
}) {
  return (
    <Step title="4. Class" status={props.status}>
      <Select
        label="Class"
        value={props.value ?? ''}
        options={classes.map((c) => ({ value: c.id, label: c.label }))}
        onChange={(v) => props.onChange(v === '' ? null : v)}
      />
      {props.replacing.map(
        (skill, i) =>
          skill && (
            <Select
              key={i}
              label={`Replacement for ${skillName(skill)}${props.replacing.length > 1 ? ` (${i + 1})` : ''}`}
              value={props.replacements[i] ?? ''}
              options={skills.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(v) => props.onReplace(i, v === '' ? null : v)}
            />
          ),
      )}
    </Step>
  );
}

/** One more skill of the player's choice (SRD 1.2.2, 1.7.0). */
export function FreeSkillStep(props: {
  value: string | null;
  status: StepStatus;
  onChange: (id: string | null) => void;
}) {
  return (
    <Step title="7. Free skill" status={props.status}>
      <Select
        label="Free skill"
        value={props.value ?? ''}
        options={skills.map((s) => ({ value: s.id, label: s.name }))}
        onChange={(v) => props.onChange(v === '' ? null : v)}
      />
    </Step>
  );
}

export function IdentityStep(props: {
  name: string;
  goal: string;
  status: StepStatus;
  onChange: (patch: { name?: string; goal?: string }) => void;
}) {
  return (
    <Step title="9. Name and goal" status={props.status}>
      <label class="field">
        <span>Name</span>
        <input
          type="text"
          maxLength={MAX_NAME}
          value={props.name}
          onInput={(e) => props.onChange({ name: (e.target as HTMLInputElement).value })}
        />
      </label>
      <label class="field">
        <span>Goal</span>
        <input
          type="text"
          maxLength={MAX_GOAL}
          value={props.goal}
          onInput={(e) => props.onChange({ goal: (e.target as HTMLInputElement).value })}
        />
      </label>
    </Step>
  );
}
