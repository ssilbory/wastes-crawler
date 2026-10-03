import { useState } from 'preact/hooks';
import { data } from '../builder/data.ts';

const monsters = [...data.srd.monsters].sort(
  (a, b) => a.hitDice - b.hitDice || a.name.localeCompare(b.name),
);
const nameOf = (id: string) => monsters.find((m) => m.id === id)?.name ?? id;
const ROW_NAMES = ['Front row', 'Second row', 'Third row'];
export const MAX_PER_ROW = 8;

/** Up to three rows of up to eight monsters for one side. */
export function MonsterPicker(props: {
  title: string;
  rows: string[][];
  onChange: (rows: string[][]) => void;
}) {
  const [pick, setPick] = useState<string>(monsters[0]?.id ?? '');
  const setRow = (index: number, row: string[]) =>
    props.onChange(props.rows.map((r, i) => (i === index ? row : r)));
  return (
    <section class="panel monster-picker" aria-label={props.title}>
      <h2>{props.title}</h2>
      <label>
        Monster{' '}
        <select value={pick} onChange={(e) => setPick((e.target as HTMLSelectElement).value)}>
          {monsters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} (HD {m.hitDice}, AC {m.ac})
            </option>
          ))}
        </select>
      </label>
      {props.rows.map((row, index) => (
        <div class="picker-row" key={index}>
          <span class="row-name">{ROW_NAMES[index]}</span>
          <div class="chips">
            {row.map((id, i) => (
              <button
                key={`${id}-${i}`}
                type="button"
                class="chip removable"
                aria-label={`Remove ${nameOf(id)} from the ${ROW_NAMES[index]?.toLowerCase()}`}
                onClick={() =>
                  setRow(
                    index,
                    row.filter((_, j) => j !== i),
                  )
                }
              >
                {nameOf(id)} ×
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={row.length >= MAX_PER_ROW || !pick}
            onClick={() => setRow(index, [...row, pick])}
          >
            Add to {ROW_NAMES[index]?.toLowerCase()}
          </button>
        </div>
      ))}
    </section>
  );
}
