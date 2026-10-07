import { useState } from 'preact/hooks';
import { mendTree, wakeTree } from '../../game/world/greenwood.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { greenwoodView } from '../../render/greenwood-view.ts';
import { data } from '../builder/data.ts';
import { spellName } from '../builder/MagicStep.tsx';

/** Rouse the Sapling and Call the Elder Tree for the party's Elementalists. */
export function GreenwoodPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const casters = greenwoodView(w, data);
  if (casters.length === 0 || w.encounter) return null;
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <section class="panel" aria-label="Greenwood">
      <h3>Greenwood</h3>
      {casters.map((c) => (
        <div key={c.id} class="parley" role="group" aria-label={c.name}>
          <p>
            <strong>{c.name}</strong>: {c.left}
          </p>
          {c.spells.map((s) => (
            <span key={s.spell}>
              <button type="button" onClick={() => run(() => wakeTree(w, data, c.id, s.spell))}>
                {spellName(s.spell)}
              </button>
              {s.mend.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => run(() => mendTree(w, data, c.id, s.spell, n.id))}
                >
                  Mend {n.name}
                </button>
              ))}
            </span>
          ))}
        </div>
      ))}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
