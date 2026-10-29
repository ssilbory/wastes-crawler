import { useState } from 'preact/hooks';
import { leaveComponent, leaveDie } from '../../game/world/party-load.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { stashView } from '../../render/stash-view.ts';
import { data } from '../builder/data.ts';

/**
 * The purse, loot dice, and components the party carries in common, what they weigh, and leaving
 * some behind (docs/rules-adaptation.md, Party stash).
 */
export function StashPanel(props: { world: World; onChange?: () => void }) {
  const w = props.world;
  const view = stashView(w, data);
  const [message, setMessage] = useState<string | null>(null);
  // Leaving loot is for good, so each button asks once more first, as dropping gear does.
  const [armed, setArmed] = useState<string | null>(null);
  const run = (key: string, action: () => TownResult) => {
    if (armed !== key) {
      setArmed(key);
      return;
    }
    setArmed(null);
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange?.();
  };
  const label = (key: string, text: string) => (armed === key ? `Really ${text}?` : text);
  const leaving = props.onChange !== undefined && !w.encounter;
  return (
    <section class="panel stash" aria-label="Stash">
      <h3>Party stash</h3>
      <dl class="stash-list">
        <div>
          <dt>Purse</dt>
          <dd>{view.purse}</dd>
        </div>
        <div>
          <dt>Loot dice</dt>
          <dd>{view.loot}</dd>
        </div>
        <div>
          <dt>Components</dt>
          <dd>{view.components.length === 0 ? 'none' : view.components.join(', ')}</dd>
        </div>
        {view.scrap && (
          <div>
            <dt>Scrap</dt>
            <dd>{view.scrap}</dd>
          </div>
        )}
        <div>
          <dt>Load</dt>
          <dd>{view.weight}</dd>
        </div>
      </dl>
      {leaving && view.dice.length + view.parts.length > 0 && (
        <div class="actions" role="group" aria-label="Leave behind">
          {view.dice.map((d) => (
            <button
              key={d.sides}
              type="button"
              onClick={() => run(`d${d.sides}`, () => leaveDie(w, d.sides))}
            >
              {label(`d${d.sides}`, `Leave a ${d.label}`)}
            </button>
          ))}
          {view.parts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => run(p.id, () => leaveComponent(w, data, p.id))}
            >
              {label(p.id, `Leave ${p.label.toLowerCase()}`)}
            </button>
          ))}
        </div>
      )}
      {message && <p class="hint">{message}</p>}
    </section>
  );
}
