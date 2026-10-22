import { useState } from 'preact/hooks';
import { drink } from '../../game/world/potions.ts';
import type { World } from '../../game/world/types.ts';
import { potionView, usable } from '../../render/potion-view.ts';
import { data } from '../builder/data.ts';

/** Potions out of combat: drink one or give it to another member (docs/rules-adaptation.md). */
export function PotionPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  if (w.encounter) return null;
  const lines = usable(potionView(w, data));
  if (lines.length === 0) return null;
  return (
    <section class="panel" aria-label="Potions">
      <h3>Potions</h3>
      {lines.map((l) => (
        <div
          key={`${l.holder.id}/${l.potion.id}`}
          class="parley"
          role="group"
          aria-label={l.potion.name}
        >
          <p>
            <strong>{l.holder.name}</strong>: {l.potion.name} ({l.count})
          </p>
          <p class="hint">{l.potion.text}</p>
          {l.targets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                const r = drink(w, data, l.holder.id, l.potion.id, t.id);
                setMessage(r.ok ? null : r.reason);
                props.onChange();
              }}
            >
              {t.id === l.holder.id ? 'Drink' : `Give ${t.name}`}
            </button>
          ))}
        </div>
      ))}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
