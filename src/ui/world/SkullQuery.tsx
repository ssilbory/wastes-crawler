import { useState } from 'preact/hooks';
import type { TownResult } from '../../game/world/services.ts';
import { isLocate } from '../../game/world/skull-locate.ts';
import { queryTheSkull, type SkullQuestion } from '../../game/world/skull.ts';
import type { World } from '../../game/world/types.ts';
import type { CasterView } from '../../render/necromancy-view.ts';
import { data } from '../builder/data.ts';

const LABELS: Record<SkullQuestion, string> = {
  map: "The level's passages",
  traps: "The level's traps",
  secrets: "The level's secret doors",
  boss: "Where the level's boss waits",
  vault: 'Where the vault lies',
  hoard: 'Where the hoards lie',
  land: 'The lay of the land',
};

/** Query the Skull: pick up to a question per caster level, at most one that locates, then cast. */
export function SkullQuery(props: {
  world: World;
  caster: CasterView;
  run: (action: () => TownResult) => void;
}) {
  const q = props.caster.query;
  const [asked, setAsked] = useState<SkullQuestion[]>([]);
  if (!q || props.world.encounter) return null;
  if (q.bar) return <p class="hint">Query the Skull: {q.bar}</p>;
  // Picking a locating question replaces any other one already picked.
  const others = (k: SkullQuestion) =>
    asked.filter((x) => x !== k && !(isLocate(k) && isLocate(x)));
  const toggle = (k: SkullQuestion) => setAsked(asked.includes(k) ? others(k) : [...others(k), k]);
  const open = q.questions.filter((k) => !isLocate(k));
  const locating = q.questions.filter(isLocate);
  const pick = (k: SkullQuestion) => (
    <label key={k}>
      <input
        type="checkbox"
        checked={asked.includes(k)}
        disabled={!asked.includes(k) && others(k).length >= q.ask}
        onChange={() => toggle(k)}
      />
      {LABELS[k]}
    </label>
  );
  return (
    <fieldset>
      <legend>
        Query the Skull (up to {q.ask} question{q.ask === 1 ? '' : 's'})
      </legend>
      {open.map(pick)}
      {locating.length > 0 && (
        <fieldset>
          <legend>Locate (one only)</legend>
          {locating.map(pick)}
        </fieldset>
      )}
      {asked.length === 0 && <p class="hint">Tick a question to ask.</p>}
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
