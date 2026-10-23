import { useState } from 'preact/hooks';
import {
  bindCompanion,
  callCompanion,
  releaseCompanion,
  renameCompanion,
  sendAway,
  swiftHealing,
} from '../../game/world/companions.ts';
import { rideCompanion, stepDown } from '../../game/world/companion-mounts.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { companionsView, type BeastmasterView } from '../../render/companions-view.ts';
import { data } from '../builder/data.ts';
import { ConfirmButton } from '../confirm.tsx';
import { HintButton } from '../hint.tsx';

const CHOSEN =
  "The only companion this Beastmaster will ever bind; it can't truly die while they live, and shares their vitality and mind.";
const BINDING = "A quarter's work in the wilds while the party rests.";

const WHERE = {
  party: 'with the party',
  ridden: 'carrying its master',
  away: 'waiting to be called',
  dawn: 'back at dawn',
} as const;

/** One Beastmaster's companion: send it away, call it, tend it, rename or release it, or bind one. */
function Beastmaster(props: {
  world: World;
  view: BeastmasterView;
  run: (action: () => TownResult) => void;
}) {
  const { world: w, view: v, run } = props;
  const [beast, setBeast] = useState('');
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState(false);
  const c = v.companion;
  const pick = v.beasts.find((b) => b.id === beast) ?? v.beasts[0];
  return (
    <div class="parley" role="group" aria-label={v.name}>
      {c ? (
        <>
          <p>
            <strong>{v.name}</strong>: {c.name}, {c.kind} ({c.hitDice} HD
            {c.chosen ? ', chosen friend' : ''}) · HP {c.hp}/{c.maxHp} · {WHERE[c.where]}
          </p>
          {v.canRide && (
            <button type="button" onClick={() => run(() => rideCompanion(w, data, v.id))}>
              Ride {c.name}
            </button>
          )}
          {c.where === 'ridden' && (
            <button type="button" onClick={() => run(() => stepDown(w, v.id))}>
              Get down from {c.name}
            </button>
          )}
          {(c.where === 'party' || c.where === 'ridden') && (
            <button type="button" onClick={() => run(() => sendAway(w, v.id))}>
              Send {c.name} away
            </button>
          )}
          {c.where === 'away' && (
            <button type="button" onClick={() => run(() => callCompanion(w, data, v.id))}>
              Call {c.name}
            </button>
          )}
          {v.canHeal && (
            <button type="button" onClick={() => run(() => swiftHealing(w, data, v.id))}>
              Swift Healing
            </button>
          )}
          {!c.chosen && (
            <ConfirmButton
              confirm="Release for good"
              onConfirm={() => run(() => releaseCompanion(w, data, v.id))}
            >
              Release {c.name}
            </ConfirmButton>
          )}
          <label>
            {' '}
            Name{' '}
            <input
              value={name}
              maxLength={40}
              placeholder={c.name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
            />
          </label>{' '}
          <button
            type="button"
            disabled={name.trim() === ''}
            onClick={() => {
              run(() => renameCompanion(w, v.id, name));
              setName('');
            }}
          >
            Rename
          </button>
        </>
      ) : (
        <>
          <p>
            <strong>{v.name}</strong> has no companion.
          </p>
          {v.bindBlocked || !pick ? (
            <p class="hint">{v.bindBlocked ?? 'No beast here is small enough to bind.'}</p>
          ) : (
            <>
              <label>
                Beast{' '}
                <select
                  value={pick.id}
                  onChange={(e) => setBeast((e.target as HTMLSelectElement).value)}
                >
                  {v.beasts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.hitDice} HD)
                    </option>
                  ))}
                </select>
              </label>{' '}
              <label>
                Name{' '}
                <input
                  value={name}
                  maxLength={40}
                  onInput={(e) => setName((e.target as HTMLInputElement).value)}
                />
              </label>{' '}
              <span class="check-row">
                <label title={CHOSEN}>
                  <input
                    type="checkbox"
                    checked={chosen}
                    onChange={(e) => setChosen((e.target as HTMLInputElement).checked)}
                  />{' '}
                  Chosen friend
                </label>
                <HintButton name="Chosen friend" text={CHOSEN} />
              </span>{' '}
              <button
                type="button"
                disabled={name.trim() === ''}
                title={BINDING}
                onClick={() => run(() => bindCompanion(w, data, v.id, pick.id, name, chosen))}
              >
                Bind Companion
              </button>
              <HintButton name="Bind Companion" text={BINDING} />
              {name.trim() === '' && <p class="hint">Name the beast to bind it.</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** The party's Beastmasters and their companions, outside a fight (1.5.4). */
export function CompanionsPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const views = companionsView(w, data);
  if (views.length === 0) return null;
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <section class="panel" aria-label="Companions">
      <h3>Companions</h3>
      {views.map((v) => (
        <Beastmaster key={v.id} world={w} view={v} run={run} />
      ))}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
