import { useState } from 'preact/hooks';
import { giveAntidote } from '../../game/world/antidote.ts';
import type { World } from '../../game/world/types.ts';
import { antidoteView } from '../../render/antidote-view.ts';
import { data } from '../builder/data.ts';

/** Antidotes, and a Poisoner's own remedy, for the Poisoned out of combat. */
export function AntidotePanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const view = antidoteView(w, data);
  if (!view || w.encounter) return null;
  return (
    <section class="panel" aria-label="Antidotes">
      <h3>Antidotes</h3>
      <p class="hint">An antidote neutralizes a lingering poison at once.</p>
      {view.givers.map((g) => (
        <div key={g.id} class="parley" role="group" aria-label={g.name}>
          <p>
            <strong>{g.name}</strong>:{' '}
            {g.doses === null ? 'a Poisoner, needing no dose' : `${g.doses} carried`}
          </p>
          {view.poisoned.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                const r = giveAntidote(w, data, g.id, p.id);
                setMessage(r.ok ? null : r.reason);
                props.onChange();
              }}
            >
              Cure {p.name}
            </button>
          ))}
        </div>
      ))}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
