import { MAX_GOAL, MAX_NAME, type StepStatus } from '../../game/character/creation.ts';
import { classes, skills } from './data.ts';
import { Select, Step } from './Field.tsx';

/** Warrior, Expert, or Adventurer (SRD 1.4.0); casters arrive in Phase 3e. */
export function ClassStep(props: {
  value: string | null;
  status: StepStatus;
  onChange: (id: string | null) => void;
}) {
  return (
    <Step title="4. Class" status={props.status}>
      <Select
        label="Class"
        value={props.value ?? ''}
        options={classes.map((c) => ({ value: c.id, label: c.name }))}
        onChange={(v) => props.onChange(v === '' ? null : v)}
      />
      {props.value !== null && (
        <p class="hint">Level-1 focus picks are chosen in a later update.</p>
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
    <Step title="5. Free skill" status={props.status}>
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
    <Step title="6. Name and goal" status={props.status}>
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
