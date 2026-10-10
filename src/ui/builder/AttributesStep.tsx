import { useState } from 'preact/hooks';
import type { Attribute } from '../../data/schemas/index.ts';
import {
  ATTRIBUTES,
  FREE_REROLLS,
  MAX_SCORE,
  MIN_SCORE,
  STANDARD_ARRAY,
  withSwap,
  type AttributeMethod,
} from '../../game/character/attributes.ts';
import type { StepStatus } from '../../game/character/creation.ts';
import type { AttributeScores } from '../../rules/attributes.ts';
import { ATTRIBUTE_NAMES } from './data.ts';
import { Select, Step } from './Field.tsx';

export type DraftArray = Partial<Record<Attribute, number>>;

/** What the step hands back: the method, and the six base scores once they are all set. */
export interface AttributeChoice {
  method: AttributeMethod;
  scores: AttributeScores | null;
}

const complete = (draft: DraftArray): AttributeScores | null =>
  ATTRIBUTES.every((a) => draft[a] !== undefined) ? (draft as AttributeScores) : null;

/**
 * The standard array, or 3d6 in order with one score swapped for 14 (SRD 1.1.1). Rerolling more
 * than FREE_REROLLS times offers to take the scores the player wants instead (Sam's call).
 */
export function AttributesStep(props: {
  method: AttributeMethod;
  scores: AttributeScores | null;
  status: StepStatus;
  roll: () => AttributeScores;
  onChange: (choice: AttributeChoice) => void;
}) {
  const { method } = props;
  const [draft, setDraft] = useState<DraftArray>({});
  const [asking, setAsking] = useState(false);
  const rerolls = method.kind === 'array' ? 0 : method.rerolls;
  const rolled = method.kind === 'roll';

  const roll = () => {
    if (rolled && rerolls >= FREE_REROLLS) {
      setAsking(true);
      return;
    }
    // A fresh roll (from another method) must not inherit a dialog left open before switching.
    setAsking(false);
    const scores = props.roll();
    const next = rolled ? rerolls + 1 : 0;
    props.onChange({ method: { kind: 'roll', rolled: scores, swap: null, rerolls: next }, scores });
  };

  return (
    <Step title="2. Attributes" status={props.status}>
      <div class="choice" role="radiogroup" aria-label="Attribute method">
        <label>
          <input
            type="radio"
            name="attribute-method"
            checked={method.kind === 'array'}
            onChange={() => {
              setDraft({});
              props.onChange({ method: { kind: 'array' }, scores: null });
            }}
          />{' '}
          Standard array
        </label>
        <label>
          <input
            type="radio"
            name="attribute-method"
            checked={method.kind !== 'array'}
            onChange={() => {
              if (method.kind === 'array') roll();
            }}
          />{' '}
          Roll 3d6 in order
        </label>
      </div>
      {method.kind === 'array' && (
        <ArrayPicker
          draft={draft}
          onChange={(next) => {
            setDraft(next);
            props.onChange({ method, scores: complete(next) });
          }}
        />
      )}
      {method.kind === 'roll' && (
        <>
          <p class="hint">
            Rolled: {ATTRIBUTES.map((a) => `${ATTRIBUTE_NAMES[a]} ${method.rolled[a]}`).join(', ')}.
          </p>
          <Select
            label="Set one score to 14"
            value={method.swap ?? ''}
            placeholder="None"
            options={ATTRIBUTES.map((a) => ({ value: a, label: ATTRIBUTE_NAMES[a] }))}
            onChange={(v) => {
              const swap = v === '' ? null : (v as Attribute);
              props.onChange({
                method: { ...method, swap },
                scores: withSwap(method.rolled, swap),
              });
            }}
          />
          <button type="button" onClick={roll}>
            Reroll
          </button>{' '}
          <span class="hint">
            Rerolls: {rerolls} of {FREE_REROLLS}
          </span>
        </>
      )}
      {method.kind === 'manual' && props.scores && (
        <ManualScores
          scores={props.scores}
          onChange={(scores) => props.onChange({ method, scores })}
        />
      )}
      {asking && method.kind === 'roll' && (
        <div class="dialog" role="alertdialog" aria-label="Your own stats">
          <p>Why don't you just tell me the stats you want?</p>
          <button
            type="button"
            onClick={() => {
              setAsking(false);
              props.onChange({
                method: { kind: 'manual', rerolls: rerolls + 1 },
                scores: withSwap(method.rolled, method.swap),
              });
            }}
          >
            Set my stats
          </button>
        </div>
      )}
    </Step>
  );
}

/** Assign each score of the standard array (SRD 1.1.1) to one attribute. */
function ArrayPicker(props: { draft: DraftArray; onChange: (draft: DraftArray) => void }) {
  const { draft } = props;
  return (
    <>
      <p class="hint">Assign 14, 12, 11, 10, 9, and 7, one to each attribute.</p>
      <div class="grid">
        {ATTRIBUTES.map((a) => {
          const taken = new Set(ATTRIBUTES.filter((o) => o !== a).map((o) => draft[o]));
          const options = STANDARD_ARRAY.filter((v) => !taken.has(v)).map((v) => ({
            value: String(v),
            label: String(v),
          }));
          return (
            <Select
              key={a}
              label={ATTRIBUTE_NAMES[a]}
              value={draft[a] === undefined ? '' : String(draft[a])}
              options={options}
              placeholder="–"
              onChange={(v) => {
                const rest = Object.fromEntries(
                  Object.entries(draft).filter(([k]) => k !== a),
                ) as DraftArray;
                props.onChange(v === '' ? rest : { ...rest, [a]: Number(v) });
              }}
            />
          );
        })}
      </div>
    </>
  );
}

/** Any score from 3 to 18 for each attribute. */
function ManualScores(props: {
  scores: AttributeScores;
  onChange: (scores: AttributeScores) => void;
}) {
  return (
    <>
      <p class="hint">Set each score from 3 to 18.</p>
      <div class="grid">
        {ATTRIBUTES.map((a) => (
          <label key={a} class="field">
            <span>{ATTRIBUTE_NAMES[a]}</span>
            <input
              type="number"
              min={MIN_SCORE}
              max={MAX_SCORE}
              value={props.scores[a]}
              onInput={(e) =>
                props.onChange({
                  ...props.scores,
                  [a]: Number((e.target as HTMLInputElement).value),
                })
              }
            />
          </label>
        ))}
      </div>
    </>
  );
}
