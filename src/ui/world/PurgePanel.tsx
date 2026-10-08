import { useState } from 'preact/hooks';
import { purgeFrailty, purgeSickness } from '../../game/world/purge.ts';
import type { World } from '../../game/world/types.ts';
import { purgeView } from '../../render/purge-view.ts';
import { data } from '../builder/data.ts';

/** Purge Ailment for the party's Healers out of combat: Frailty, poison, and disease. */
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
        Effort for the day cures an ally of a poison or a disease; some diseases need a Heal check
        first. Lifting Frailty takes a Heal check against {rules.difficulty} and 1 System Strain,
        one try per Frailty. The Effort is spent even if a check fails.
      </p>
      {view.healers.map((h) => (
        <div key={h.id} class="parley" role="group" aria-label={h.name}>
          <p>
            <strong>{h.name}</strong>: {h.effortLeft} Effort left today
          </p>
          {h.tend.map((t) => (
            <button
              key={`${t.id}:${t.ailment}`}
              type="button"
              disabled={h.effortLeft === 0}
              onClick={() => {
                const r =
                  t.ailment === 'frailty'
                    ? purgeFrailty(w, data, h.id, t.id)
                    : purgeSickness(w, data, h.id, t.id, t.ailment);
                setMessage(r.ok ? null : r.reason);
                props.onChange();
              }}
            >
              Purge {t.name}'s {t.label}
            </button>
          ))}
        </div>
      ))}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
