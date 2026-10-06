import { useEffect, useState } from 'preact/hooks';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { castersOf, HIGH_ROAD, highRoads, openHighRoad } from '../../game/world/waygates.ts';
import { data } from '../builder/data.ts';

/** Open the High Road to a town the party has visited, for each caster with it prepared. */
export function HighRoadPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const casters = castersOf(w, HIGH_ROAD);
  const towns = highRoads(w, data);
  const hidden = casters.length === 0 || towns.length === 0 || !!w.encounter || !!w.coach;
  // A refusal is news only until the panel hides or the day turns.
  useEffect(() => setMessage(null), [hidden, w.day]);
  if (hidden) return null;
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <section class="panel" aria-label="High Road">
      <h3>Open the High Road</h3>
      {casters.map((m) => (
        <div key={m.id} class="parley" role="group" aria-label={m.character.name}>
          <p>
            <strong>{m.character.name}</strong> opens a road to:
          </p>
          {towns.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => run(() => openHighRoad(w, data, m.id, t.id))}
            >
              {t.name}
            </button>
          ))}
        </div>
      ))}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
