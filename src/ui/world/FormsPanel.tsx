import { useState } from 'preact/hooks';
import { shiftMember } from '../../game/world/forms.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { formsView } from '../../render/forms-view.ts';
import { data } from '../builder/data.ts';

/** Change Form outside a fight, for the party's Skinshifters. */
export function FormsPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const shifters = formsView(w);
  if (shifters.length === 0) return null;
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <section class="panel" aria-label="Forms">
      <h3>Forms</h3>
      {shifters.map((s) => (
        <div key={s.id} class="parley" role="group" aria-label={s.name}>
          <p>
            <strong>{s.name}</strong>: {s.worn ? `${s.worn} form` : 'own shape'}
          </p>
          {s.forms.map((f) => (
            <button
              key={f.index}
              type="button"
              onClick={() => run(() => shiftMember(w, data, s.id, f.index))}
            >
              Take the {f.name} form
            </button>
          ))}
          {s.worn && (
            <button type="button" onClick={() => run(() => shiftMember(w, data, s.id, null))}>
              Own shape
            </button>
          )}
        </div>
      ))}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
