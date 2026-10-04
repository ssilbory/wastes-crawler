import { useState } from 'preact/hooks';
import { bluff, giveCountersign, presentAuthority } from '../../game/world/orders.ts';
import { acceptOffer, bribePrice, canParley, parley } from '../../game/world/parley.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { orderChoices } from '../../render/setting-view.ts';
import { crowns } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';

/**
 * A pending encounter: fight, leave, or parley once (docs/rules-adaptation.md, Parley); a bound
 * group's standing order can also be ended or bluffed (Standing orders).
 */
export function EncounterPanel(props: {
  world: World;
  onFight: () => void;
  onLeave: () => void;
  onChange: () => void;
}) {
  const w = props.world;
  const e = w.encounter;
  const able = w.members.filter((m) => !m.dead && m.character.hp.current > 0);
  const [speaker, setSpeaker] = useState(able[0]?.id ?? '');
  const [message, setMessage] = useState<string | null>(null);
  if (!e) return null;
  const order = orderChoices(w, data);
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <section class="panel encounter" aria-label="Encounter" aria-live="polite">
      <h2>Encounter</h2>
      <p>{e.text}</p>
      <div class="actions">
        <button type="button" class="create" onClick={props.onFight}>
          {e.hostile ? 'Fight' : 'Attack them'}
        </button>
        {(!e.hostile || e.spotted) && (
          <button type="button" onClick={props.onLeave}>
            {e.hostile ? 'Slip away' : 'Let them pass'}
          </button>
        )}
        {e.offer && (
          <button type="button" onClick={() => run(() => acceptOffer(w, data))}>
            Take them on
          </button>
        )}
      </div>
      {order && (
        <div class="parley" role="group" aria-label="Standing order">
          <p class="hint">Standing order: {order.name}</p>
          {order.countersign && (
            <button type="button" onClick={() => run(() => giveCountersign(w, data))}>
              Give the countersign
            </button>
          )}
          {order.authority && (
            <button type="button" onClick={() => run(() => presentAuthority(w, data))}>
              Show {order.authority}
            </button>
          )}
          {order.bluff && (
            <button type="button" onClick={() => run(() => bluff(w, data, speaker))}>
              Bluff
            </button>
          )}
        </div>
      )}
      {(canParley(w, data) || order?.bluff) && (
        <label>
          Speaker{' '}
          <select
            value={speaker}
            onChange={(ev) => setSpeaker((ev.target as HTMLSelectElement).value)}
          >
            {able.map((m) => (
              <option key={m.id} value={m.id}>
                {m.character.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {canParley(w, data) && (
        <div class="parley" role="group" aria-label="Parley">
          <button type="button" onClick={() => run(() => parley(w, data, 'talk', speaker))}>
            Talk
          </button>
          <button type="button" onClick={() => run(() => parley(w, data, 'intimidate', speaker))}>
            Intimidate
          </button>
          <button type="button" onClick={() => run(() => parley(w, data, 'bribe', null))}>
            Bribe ({crowns(bribePrice(w, data))})
          </button>
        </div>
      )}
      {message && <p class="hint">{message}</p>}
    </section>
  );
}
