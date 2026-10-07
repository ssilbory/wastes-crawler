import type { ComponentChildren } from 'preact';
import type { StepStatus } from '../../game/character/creation.ts';

export interface Option {
  value: string;
  label: string;
}

/** A labelled select; the empty value means "not chosen yet". */
export function Select(props: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label class="field">
      <span>{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange((e.target as HTMLSelectElement).value)}
      >
        <option value="">{props.placeholder ?? 'Choose…'}</option>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Step(props: { title: string; status: StepStatus; children: ComponentChildren }) {
  const { status } = props;
  return (
    <section class={`step step-${status.state}`}>
      <h2>
        {props.title}
        {status.state === 'ok' && <span class="tick"> ✓</span>}
      </h2>
      {props.children}
      {status.state === 'error' && (
        <p class="error" role="alert">
          {status.message}
        </p>
      )}
    </section>
  );
}

/** A labeled checkbox. */
export function Check(props: {
  label: string;
  checked: boolean;
  title?: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <label class="check" title={props.title}>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange((e.target as HTMLInputElement).checked)}
      />
      {props.label}
    </label>
  );
}
