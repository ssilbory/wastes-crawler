import type { Attribute } from '../../data/schemas/index.ts';
import type { Adjustments } from '../../game/character/attributes.ts';
import { ATTRIBUTES } from '../../game/character/attributes.ts';
import type { StepStatus } from '../../game/character/creation.ts';
import { findPeople } from '../../game/character/people.ts';
import { data, signed } from './data.ts';
import { Select, Step } from './Field.tsx';

const SHORT: Record<Attribute, string> = {
  str: 'Str',
  dex: 'Dex',
  con: 'Con',
  int: 'Int',
  wis: 'Wis',
  cha: 'Cha',
};

function modifierText(mods: Adjustments): string {
  const parts = ATTRIBUTES.filter((a) => mods[a]).map((a) => `${signed(mods[a] ?? 0)} ${SHORT[a]}`);
  return parts.length > 0 ? parts.join(', ') : 'no modifiers';
}

/** The setting's peoples and centaur lineages (docs/rules-adaptation.md, Peoples). */
export function PeopleStep(props: {
  people: string;
  lineage: string | null;
  status: StepStatus;
  onChange: (people: string, lineage: string | null) => void;
}) {
  const people = findPeople(data, props.people);
  const lineage = people?.lineages?.find((l) => l.id === props.lineage);
  return (
    <Step title="1. People" status={props.status}>
      <Select
        label="People"
        value={props.people}
        options={data.content.peoples.map((p) => ({ value: p.id, label: p.name }))}
        onChange={(id) => props.onChange(id, null)}
      />
      {people && (
        <p class="hint">
          {people.description} {modifierText(people.attributeModifiers)}; {people.size} size.
        </p>
      )}
      {people?.lineages && (
        <>
          <Select
            label="Lineage"
            value={props.lineage ?? ''}
            options={people.lineages.map((l) => ({ value: l.id, label: l.name }))}
            onChange={(id) => props.onChange(people.id, id === '' ? null : id)}
          />
          {lineage && (
            <p class="hint">
              {lineage.description} {modifierText(lineage.attributeModifiers)}, on top of the{' '}
              {people.name} modifiers.
            </p>
          )}
        </>
      )}
    </Step>
  );
}
