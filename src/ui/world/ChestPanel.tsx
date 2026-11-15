import { useState } from 'preact/hooks';
import { disarmChest, openChest } from '../../game/world/chests.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { chestView, type ChestAction } from '../../render/chest-view.ts';
import { data } from '../builder/data.ts';

/** Who tries, and what the party's gear does to it. */
const by = (a: ChestAction) => [a.hand, a.gear].filter(Boolean).join(', ');

/**
 * The locked vault or boss chest where the party stands (docs/rules-adaptation.md, Locks and
 * chests): disarm its spotted trap, pick the lock, or force it. Each try takes a turn below ground.
 */
export function ChestPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const view = chestView(w, data);
  if (!view) return null;
  const turn = w.dungeon ? ', 1 turn' : '';
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  const busy = w.encounter !== null;
  return (
    <section class="panel" aria-label={`Locked ${view.name}`}>
      <h3>Locked {view.name}</h3>
      <p class="hint">{view.trap}</p>
      {view.disarm && (
        <button type="button" disabled={busy} onClick={() => run(() => disarmChest(w, data))}>
          Disarm the trap ({by(view.disarm)}
          {turn})
        </button>
      )}
      <button type="button" disabled={busy} onClick={() => run(() => openChest(w, data, 'pick'))}>
        Pick the lock ({by(view.pick)}
        {turn})
      </button>
      <button type="button" disabled={busy} onClick={() => run(() => openChest(w, data, 'force'))}>
        Force it open ({by(view.force)}
        {turn})
      </button>
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
