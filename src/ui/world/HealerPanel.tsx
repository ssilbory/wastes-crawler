import { useState } from 'preact/hooks';
import { reviveFallen } from '../../game/world/healer.ts';
import type { World } from '../../game/world/types.ts';
import { healerView } from '../../render/healer-view.ts';
import { data } from '../builder/data.ts';

/** Revive the Fallen for the party's Healers, in the aftermath of a fight (Phase 14d). */
export function HealerPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const view = healerView(w, data);
  if (!view || w.encounter) return null;
  return (
    <section class="panel" aria-label="Revive the Fallen">
      <h3>Revive the Fallen</h3>
      <p class="hint">The slain can be revived here, before the party moves on or rests.</p>
      {view.healers.map((h) => (
        <div key={h.id} class="parley" role="group" aria-label={h.name}>
          <p>
            <strong>{h.name}</strong>: {h.effortLeft} Effort left today
          </p>
          {view.fallen.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                const r = reviveFallen(w, data, h.id, f.id);
                setMessage(r.ok ? null : r.reason);
                props.onChange();
              }}
            >
              Revive {f.name}
            </button>
          ))}
        </div>
      ))}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
