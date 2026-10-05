import { useState } from 'preact/hooks';
import { bluff, giveCountersign, presentAuthority } from '../../game/world/orders.ts';
import { acceptBeast, beastRefusal, handlers } from '../../game/world/beasts.ts';
import { acceptOffer, bribePrice, canParley, parley } from '../../game/world/parley.ts';
import { bestSpeaker, type Speech } from '../../game/world/speech.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { beastOfferText, knownFoes } from '../../render/bestiary-view.ts';
import { orderChoices } from '../../render/setting-view.ts';
import { crowns } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import { KnownFoes } from './KnownFoes.tsx';

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
  const keepers = handlers(w, data);
  const [handler, setHandler] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  if (!e) return null;
  const order = orderChoices(w, data);
  // Each kind of speech goes to whoever in the party is best at it.
  const speaker = (speech: Speech) => bestSpeaker(w, data, speech);
  const who = (speech: Speech) => {
    const m = speaker(speech);
    return m ? ` (${m.character.name})` : '';
  };
  const keeper = keepers.find((m) => m.id === handler) ?? keepers[0];
  const refusal = e.beast ? beastRefusal(w, data) : null;
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <section class="panel encounter" aria-label="Encounter" aria-live="polite">
      <h2>Encounter</h2>
      <p>{e.text}</p>
      <KnownFoes foes={knownFoes(w, data, e.enemies)} />
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
      {e.beast && refusal && <p class="hint">{refusal}</p>}
      {e.beast && !refusal && keeper && (
        <div class="beast" role="group" aria-label="Beast">
          <p class="hint">{beastOfferText(w, data)}</p>
          <label>
            Handler{' '}
            <select
              value={keeper.id}
              onChange={(ev) => setHandler((ev.target as HTMLSelectElement).value)}
            >
              {keepers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.character.name}
                </option>
              ))}
            </select>
          </label>{' '}
          <button type="button" onClick={() => run(() => acceptBeast(w, data, keeper.id))}>
            Win it over
          </button>
        </div>
      )}
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
            <button
              type="button"
              onClick={() => run(() => bluff(w, data, speaker('bluff')?.id ?? ''))}
            >
              Bluff{who('bluff')}
            </button>
          )}
        </div>
      )}
      {canParley(w, data) && (
        <div class="parley" role="group" aria-label="Parley">
          <button
            type="button"
            onClick={() => run(() => parley(w, data, 'talk', speaker('talk')?.id ?? null))}
          >
            Talk{who('talk')}
          </button>
          <button
            type="button"
            onClick={() =>
              run(() => parley(w, data, 'intimidate', speaker('intimidate')?.id ?? null))
            }
          >
            Intimidate{who('intimidate')}
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
