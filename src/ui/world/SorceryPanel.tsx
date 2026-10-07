import { useEffect, useState } from 'preact/hooks';
import { apprehend } from '../../game/dungeon/arcane-sight.ts';
import { dissolve, pierceGate } from '../../game/dungeon/stonework.ts';
import { adoptVisage, raisePalanquin } from '../../game/world/guises.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { sorceryView } from '../../render/sorcery-view.ts';
import { data } from '../builder/data.ts';

/** High Magic cast outside fights: disguise, palanquin, arcane sight, and the stone spells. */
export function SorceryPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const view = sorceryView(w, data);
  // A refusal is news only until the day turns.
  useEffect(() => setMessage(null), [w.day]);
  if (!view) return null;
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <section class="panel" aria-label="High Magic">
      <h3>High Magic</h3>
      {view.status.map((line) => (
        <p key={line} class="hint">
          {line}
        </p>
      ))}
      {view.casters.map((c) => (
        <div key={c.id} class="parley" role="group" aria-label={c.name}>
          <p>
            <strong>{c.name}</strong>
          </p>
          {c.visage && (
            <button type="button" onClick={() => run(() => adoptVisage(w, data, c.id))}>
              Take the seeming of the bound
            </button>
          )}
          {c.palanquin && (
            <button type="button" onClick={() => run(() => raisePalanquin(w, data, c.id))}>
              Call the jade palanquin
            </button>
          )}
          {c.sight && (
            <button type="button" onClick={() => run(() => apprehend(w, data, c.id))}>
              Open arcane sight
            </button>
          )}
          {c.dissolve && (
            <button type="button" onClick={() => run(() => dissolve(w, data, c.id))}>
              Dissolve the stone ahead (1 turn)
            </button>
          )}
          {c.gates.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => run(() => pierceGate(w, data, c.id, g.at))}
            >
              Open a rift to {g.label}
            </button>
          ))}
        </div>
      ))}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
