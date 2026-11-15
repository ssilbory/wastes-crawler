import { useEffect, useState } from 'preact/hooks';
import { disarmDoor, openDoor } from '../../game/dungeon/doors.ts';
import { disarmChest, openChest } from '../../game/world/chests.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { lockView, type LockAction } from '../../render/lock-view.ts';
import { data } from '../builder/data.ts';
import { LockArt } from './LockArt.tsx';
import { PopOut } from './PopOut.tsx';

/** Who tries, and what the party's gear does to it. */
const by = (a: LockAction) => [a.hand ?? 'no one', a.gear].filter(Boolean).join(', ');

/**
 * The locked chest, vault, or door before the party (docs/rules-adaptation.md, Locks and chests),
 * popping out on reaching it: disarm its spotted trap, pick the lock, force it, or leave it until
 * the party comes back. Each try takes a turn below ground.
 */
export function LockPopOut(props: { world: World; hidden: boolean; onChange: () => void }) {
  const w = props.world;
  const [left, setLeft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const view = lockView(w, data);
  // Walking off it lets it pop out again on coming back.
  useEffect(() => {
    if (view?.at !== left) setLeft(null);
  }, [view?.at]);
  if (!view || props.hidden || w.encounter || left === view.at) return null;
  const door = view.kind === 'door';
  const turn = w.dungeon ? ', 1 turn' : '';
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  const leave = () => {
    setLeft(view.at);
    setMessage(null);
  };
  return (
    <PopOut label={`A locked ${view.kind}`} onEscape={leave}>
      <section class="panel lock-pop">
        <h2>A locked {view.kind}</h2>
        <LockArt kind={view.kind} />
        <p>{view.trap}</p>
        <div class="actions">
          {view.disarm && (
            <button
              type="button"
              onClick={() => run(() => (door ? disarmDoor(w, data) : disarmChest(w, data)))}
            >
              Disarm the trap ({by(view.disarm)}
              {turn})
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              run(() => (door ? openDoor(w, data, 'pick') : openChest(w, data, 'pick')))
            }
          >
            Pick the lock ({by(view.pick)}
            {turn})
          </button>
          <button
            type="button"
            onClick={() =>
              run(() => (door ? openDoor(w, data, 'force') : openChest(w, data, 'force')))
            }
          >
            {view.forceLabel} ({by(view.force)}
            {turn})
          </button>
          <button type="button" onClick={leave}>
            Leave it
          </button>
        </div>
        {view.noise && <p class="hint">{view.noise}</p>}
        {message && <p role="alert">{message}</p>}
      </section>
    </PopOut>
  );
}
