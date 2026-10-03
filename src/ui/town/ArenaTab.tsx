import { arenaCard, boutBlocked, startBout, type BoutStart } from '../../game/world/arena.ts';
import { priceHere } from '../../game/world/town.ts';
import type { World } from '../../game/world/types.ts';
import { crowns } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

type Started = Extract<BoutStart, { ok: true }>;

/** The town arena's card: prize fights to yield, and monsters to the death. */
export function ArenaTab(props: { world: World; act: Act; onBout: (start: Started) => void }) {
  const w = props.world;
  const blocked = boutBlocked(w, data);
  return (
    <section class="panel" aria-label="Arena">
      <h2>Arena</h2>
      <p class="hint">
        One bout a day, with the party as it stands. Against people the loser yields and the fallen
        are pulled out alive but Frail; against monsters it is to the death.
      </p>
      {blocked && <p class="hint">{blocked}</p>}
      {arenaCard(w, data).length === 0 && <p class="hint">There is no arena here.</p>}
      <ul class="tavern-list">
        {arenaCard(w, data).map((b) => (
          <li key={b.id}>
            <span>
              <strong>{b.name}</strong> fee {crowns(priceHere(w, data, b.fee))}, prize{' '}
              {crowns(b.prize)}
              {b.toTheDeath ? ' · to the death' : ' · to yield'}
            </span>
            <button
              type="button"
              disabled={blocked !== null}
              onClick={() =>
                props.act(() => {
                  const r = startBout(w, data, b.id);
                  if (!r.ok) return r;
                  props.onBout(r);
                  return { ok: true };
                })
              }
            >
              Fight
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
