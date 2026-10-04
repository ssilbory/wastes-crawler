import { useState } from 'preact/hooks';
import {
  commandTheDead,
  mendCorpse,
  raiseCorpse,
  raiseGraveKnight,
} from '../../game/world/necromancy.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { necromancyView } from '../../render/necromancy-view.ts';
import { data } from '../builder/data.ts';

/** Raise Corpse, Raise Grave Knight, and Command the Dead for the party's Necromancers. */
export function NecromancyPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const view = necromancyView(w, data);
  if (!view) return null;
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <section class="panel" aria-label="Necromancy">
      <h3>Necromancy</h3>
      <p class="hint">
        {view.corpses === 0
          ? 'No corpses lie here.'
          : view.corpses === 1
            ? 'A corpse lies here.'
            : `${view.corpses} corpses lie here.`}
      </p>
      {view.casters.map((c) => (
        <div key={c.id} class="parley" role="group" aria-label={c.name}>
          <p>
            <strong>{c.name}</strong>: {c.spellsLeft} spell{c.spellsLeft === 1 ? '' : 's'} left
            today
          </p>
          {c.raise && !w.encounter && (
            <>
              <button type="button" onClick={() => run(() => raiseCorpse(w, data, c.id, 'zombie'))}>
                Raise a zombie
              </button>
              <button
                type="button"
                onClick={() => run(() => raiseCorpse(w, data, c.id, 'skeleton'))}
              >
                Raise a skeleton
              </button>
            </>
          )}
          {c.knight && !w.encounter && (
            <button type="button" onClick={() => run(() => raiseGraveKnight(w, data, c.id))}>
              Raise a Grave Knight
            </button>
          )}
          {c.command && w.encounter && (
            <button type="button" onClick={() => run(() => commandTheDead(w, data, c.id))}>
              Command the Dead
            </button>
          )}
          {!w.encounter &&
            c.mend.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => run(() => mendCorpse(w, data, c.id, n.id))}
              >
                Mend {n.name}
              </button>
            ))}
        </div>
      ))}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
