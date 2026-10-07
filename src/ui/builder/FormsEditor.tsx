import type { Form } from '../../data/schemas/index.ts';
import { ATTRIBUTE_NAMES } from './data.ts';
import { Check, Select } from './Field.tsx';

const FERAL = ['str', 'dex', 'con'] as const;
/** Arts applied to a form, at most three (1.5.15). */
const MOST_ARTS = 3;

/** Builds a Skinshifter's forms: a name, a shape, and up to three of the arts they hold. */
export function FormsEditor(props: {
  forms: readonly Form[];
  arts: readonly { id: string; name: string; hint?: string }[];
  max: number;
  onChange: (forms: Form[]) => void;
}) {
  const set = (i: number, form: Form) =>
    props.onChange(props.forms.map((f, j) => (j === i ? form : f)));
  const toggleArt = (f: Form, id: string, on: boolean): Form => {
    const arts = on ? [...f.arts, id] : f.arts.filter((a) => a !== id);
    const next: Form = { name: f.name, humanoid: f.humanoid, arts };
    return arts.includes('feral-prowess') ? { ...next, feral: f.feral ?? 'str' } : next;
  };
  return (
    <fieldset class="picks">
      <legend>
        Forms: up to {props.max}, each with up to {MOST_ARTS} arts
      </legend>
      {props.forms.map((f, i) => (
        <div key={i} class="form-shape" role="group" aria-label={`Form ${i + 1}`}>
          <label class="field">
            <span>Form {i + 1} name</span>
            <input
              type="text"
              value={f.name}
              maxLength={40}
              onInput={(e) => set(i, { ...f, name: (e.target as HTMLInputElement).value })}
            />
          </label>
          <Check
            label="Humanoid shape"
            checked={f.humanoid}
            onChange={(on) => set(i, { ...f, humanoid: on })}
          />
          {props.arts.map((a) => (
            <Check
              key={a.id}
              label={a.name}
              {...(a.hint ? { title: a.hint } : {})}
              checked={f.arts.includes(a.id)}
              onChange={(on) => {
                if (on && f.arts.length >= MOST_ARTS) return;
                set(i, toggleArt(f, a.id, on));
              }}
            />
          ))}
          {f.feral && (
            <Select
              label={`Form ${i + 1}: Feral Prowess raises`}
              value={f.feral}
              options={FERAL.map((x) => ({ value: x, label: ATTRIBUTE_NAMES[x] }))}
              onChange={(v) => set(i, { ...f, feral: v as (typeof FERAL)[number] })}
            />
          )}
          <button
            type="button"
            onClick={() => props.onChange(props.forms.filter((_, j) => j !== i))}
          >
            Drop form {i + 1}
          </button>
        </div>
      ))}
      {props.forms.length < props.max && (
        <button
          type="button"
          onClick={() =>
            props.onChange([
              ...props.forms,
              { name: `Form ${props.forms.length + 1}`, humanoid: false, arts: [] },
            ])
          }
        >
          Add a form
        </button>
      )}
    </fieldset>
  );
}
