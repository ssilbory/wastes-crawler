import { useState } from 'preact/hooks';
import type { Attribute, Background, GrowthEntry } from '../../data/schemas/index.ts';
import { ATTRIBUTES, MENTAL, PHYSICAL, type Adjustments } from '../../game/character/attributes.ts';
import type { RolledEntry } from '../../game/character/creation.ts';
import type { Skills } from '../../game/character/skills.ts';
import { ATTRIBUTE_NAMES, entryLabel } from './data.ts';
import { EntrySkillChoice } from './EntryChoice.tsx';
import { Select } from './Field.tsx';

type Table = 'growth' | 'learning';
const TABLE_OPTIONS = [
  { value: 'growth', label: 'Growth (d6)' },
  { value: 'learning', label: 'Learning (d8)' },
];

/** Places a Growth attribute bonus: +1 to one attribute, or +2 as one +2 or two +1s. */
function AllocationChoice(props: {
  label: string;
  entry: Extract<GrowthEntry, { kind: 'attribute' }>;
  onChange: (allocation: Adjustments | undefined) => void;
}) {
  const [parts, setParts] = useState<(Attribute | '')[]>(Array(props.entry.amount).fill(''));
  const pool =
    props.entry.pool === 'physical'
      ? PHYSICAL
      : props.entry.pool === 'mental'
        ? MENTAL
        : ATTRIBUTES;
  const options = pool.map((a) => ({ value: a, label: ATTRIBUTE_NAMES[a] }));
  const update = (i: number, v: string) => {
    const next = parts.map((p, j) => (j === i ? (v as Attribute | '') : p));
    setParts(next);
    if (next.some((p) => p === '')) return props.onChange(undefined);
    const allocation: Adjustments = {};
    for (const a of next as Attribute[]) allocation[a] = (allocation[a] ?? 0) + 1;
    props.onChange(allocation);
  };
  return (
    <>
      {parts.map((p, i) => (
        <Select
          key={i}
          label={
            parts.length > 1 ? `+1 for ${props.label}, part ${i + 1}` : `+1 for ${props.label}`
          }
          value={p}
          options={options}
          onChange={(v) => update(i, v)}
        />
      ))}
    </>
  );
}

/** Three rolls split between Growth and Learning as the player chooses (SRD 1.3.2). */
export function BackgroundRolls(props: {
  background: Background;
  rolls: RolledEntry[] | null;
  priorFor: (i: number) => Skills;
  onRoll: (tables: Table[]) => void;
  onChange: (rolls: RolledEntry[]) => void;
}) {
  const [tables, setTables] = useState<(Table | '')[]>(['', '', '']);
  const { rolls, background } = props;
  if (!rolls) {
    const ready = tables.every((t) => t !== '');
    return (
      <div class="rolls">
        {tables.map((t, i) => (
          <Select
            key={i}
            label={`Table for roll ${i + 1}`}
            value={t}
            options={TABLE_OPTIONS}
            onChange={(v) => setTables(tables.map((x, j) => (j === i ? (v as Table | '') : x)))}
          />
        ))}
        <button type="button" disabled={!ready} onClick={() => props.onRoll(tables as Table[])}>
          Roll
        </button>
      </div>
    );
  }
  const set = (
    i: number,
    patch: { skill?: string | undefined; allocation?: Adjustments | undefined },
  ) =>
    props.onChange(
      rolls.map((r, j) => {
        if (j !== i) return r;
        const { table, index, skill, allocation } = { ...r, ...patch };
        return {
          table,
          index,
          ...(skill === undefined ? {} : { skill }),
          ...(allocation === undefined ? {} : { allocation }),
        };
      }),
    );
  return (
    <ol class="rolls">
      {rolls.map((r, i) => {
        const entry = (r.table === 'growth' ? background.growth : background.learning)[r.index];
        if (!entry) return null;
        const label = `roll ${i + 1}`;
        return (
          <li key={i}>
            <span>
              {r.table === 'growth' ? 'Growth' : 'Learning'} {r.index + 1}: {entryLabel(entry)}
            </span>
            {entry.kind === 'attribute' ? (
              <AllocationChoice
                label={label}
                entry={entry}
                onChange={(allocation) => set(i, { allocation })}
              />
            ) : (
              <EntrySkillChoice
                label={label}
                entry={entry}
                prior={props.priorFor(i)}
                value={r.skill}
                onChange={(skill) => set(i, { skill })}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
