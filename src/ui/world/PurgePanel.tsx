import { useState } from 'preact/hooks';
import { purgeFrailty } from '../../game/world/purge.ts';
import type { World } from '../../game/world/types.ts';
import { purgeView } from '../../render/purge-view.ts';
import { data } from '../builder/data.ts';

/** Purge Ailment for the party's Healers, lifting an ally's Frailty out of combat. */
export function PurgePanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const view = purgeView(w, data);
  if (!view || w.encounter) return null;
  const rules = data.content.skillRules.purgeAilment;
  return (
    <section class="panel" aria-label="Purge Ailment">
      <h3>Purge Ailment</h3>
      <p class="hint">
        Effort for the day and a Heal check against {rules.difficulty} lift an ally's Frailty. The
        Effort is spent even if the check fails.
      </p>
      {view.healers.map((h) => (
        <div key={h.id} class="parley" role="group" aria-label={h.name}>
          <p>
            <strong>{h.name}</strong>: {h.effortLeft} Effort left today
          </p>
          {h.frail.map((f) => (
            <button
              key={f.id}
              type="button"
              disabled={h.effortLeft === 0}
              onClick={() => {
                const r = purgeFrailty(w, data, h.id, f.id);
                setMessage(r.ok ? null : r.reason);
                props.onChange();
              }}
            >
              Purge {f.name}
            </button>
          ))}
        </div>
      ))}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
