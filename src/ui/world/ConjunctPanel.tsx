import { useState } from 'preact/hooks';
import type { TownResult } from '../../game/world/services.ts';
import { infusable, infuse, VISCERA } from '../../game/world/sorcery.ts';
import type { World } from '../../game/world/types.ts';
import { castersOf } from '../../game/world/waygates.ts';
import { data } from '../builder/data.ts';

/** Conjunct the Vital Viscera outside fights: hit points to a hurt member from a hale one. */
export function ConjunctPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const casters = castersOf(w, VISCERA);
  const hurt = infusable(w);
  if (casters.length === 0 || hurt.length === 0 || w.encounter) return null;
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <section class="panel" aria-label="Conjunct the Vital Viscera">
      <h3>Conjunct the Vital Viscera</h3>
      {casters.map((m) => (
        <div key={m.id} class="parley" role="group" aria-label={m.character.name}>
          <p>
            <strong>{m.character.name}</strong> moves hit points to:
          </p>
          {hurt.map((t) => (
            <button key={t.id} type="button" onClick={() => run(() => infuse(w, data, m.id, t.id))}>
              {t.character.name}
            </button>
          ))}
        </div>
      ))}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
