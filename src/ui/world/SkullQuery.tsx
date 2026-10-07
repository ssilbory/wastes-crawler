import { useState } from 'preact/hooks';
import type { TownResult } from '../../game/world/services.ts';
import { queryTheSkull, type SkullQuestion } from '../../game/world/skull.ts';
import type { World } from '../../game/world/types.ts';
import type { CasterView } from '../../render/necromancy-view.ts';
import { data } from '../builder/data.ts';

const LABELS: Record<SkullQuestion, string> = {
  map: "The level's passages",
  traps: "The level's traps",
  secrets: "The level's secret doors",
  land: 'The lay of the land',
};

/** Query the Skull: pick up to a question per caster level, then cast. */
export function SkullQuery(props: {
  world: World;
  caster: CasterView;
  run: (action: () => TownResult) => void;
}) {
  const q = props.caster.query;
  const [asked, setAsked] = useState<SkullQuestion[]>([]);
  if (!q || props.world.encounter) return null;
  if (q.bar) return <p class="hint">Query the Skull: {q.bar}</p>;
  const toggle = (k: SkullQuestion) =>
    setAsked(asked.includes(k) ? asked.filter((x) => x !== k) : [...asked, k]);
  return (
    <fieldset>
      <legend>
        Query the Skull (up to {q.ask} question{q.ask === 1 ? '' : 's'})
      </legend>
      {q.questions.map((k) => (
        <label key={k}>
          <input
            type="checkbox"
            checked={asked.includes(k)}
            disabled={!asked.includes(k) && asked.length >= q.ask}
            onChange={() => toggle(k)}
          />
          {LABELS[k]}
        </label>
      ))}
      <button
        type="button"
        disabled={asked.length === 0}
        onClick={() => {
          props.run(() => queryTheSkull(props.world, data, props.caster.id, asked));
          setAsked([]);
        }}
      >
        Question the dead
      </button>
    </fieldset>
  );
}
