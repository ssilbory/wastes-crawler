import type { Attribute } from '../../data/schemas/index.ts';
import { ATTRIBUTES, STANDARD_ARRAY } from '../../game/character/attributes.ts';
import type { StepStatus } from '../../game/character/creation.ts';
import { ATTRIBUTE_NAMES } from './data.ts';
import { Select, Step } from './Field.tsx';

export type DraftArray = Partial<Record<Attribute, number>>;

/** Assign each score of the standard array (SRD 1.1.0) to one attribute. */
export function AttributesStep(props: {
  draft: DraftArray;
  status: StepStatus;
  onChange: (draft: DraftArray) => void;
}) {
  const { draft } = props;
  return (
    <Step title="1. Attributes" status={props.status}>
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
    </Step>
  );
}
