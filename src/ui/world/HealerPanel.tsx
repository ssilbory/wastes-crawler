import { useState } from 'preact/hooks';
import { reviveFallen } from '../../game/world/healer.ts';
import type { World } from '../../game/world/types.ts';
import { healerView, leavingWarning, reviveOffered } from '../../render/healer-view.ts';
import { data } from '../builder/data.ts';
import { PopOut } from './PopOut.tsx';

/**
 * Revive the Fallen for the party's Healers, in the aftermath of a fight (Phase 14d). With
 * `onLeave`, it is the popup asking before the party moves on, and can be waved away.
 */
export function HealerPanel(props: { world: World; onChange: () => void; onLeave?: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const view = healerView(w, data);
  if (!view || w.encounter) return null;
  return (
    <section class="panel" aria-label="Revive the Fallen">
      <h3>Revive the Fallen</h3>
      <p class="hint">The slain can be revived here, before the party moves on or rests.</p>
      {view.healers.map((h) => (
        <div key={h.id} class="parley" role="group" aria-label={h.name}>
          <p>
            <strong>{h.name}</strong>: {h.effortLeft} Effort left today
          </p>
          {h.unable && <p class="hint">{h.unable}</p>}
          {view.fallen.map((f) => (
            <button
              key={f.id}
              type="button"
              disabled={!!h.unable}
              onClick={() => {
                const r = reviveFallen(w, data, h.id, f.id);
                setMessage(r.ok ? null : r.reason);
                props.onChange();
              }}
            >
              Revive {f.name}
            </button>
          ))}
        </div>
      ))}
      {message && <p class="bump">{message}</p>}
      {props.onLeave && (
        <>
          <p class="bump">{leavingWarning(view)}</p>
          <div class="actions">
            <button type="button" class="secondary" onClick={props.onLeave}>
              Not now
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Whether to ask about reviving the fallen before the party moves on: a Healer here has Effort
 * for it, and the party hasn't said "Not now" to these fallen. While asked, the screen holds its
 * moves; once waved away, the dock's panel still offers it until the party leaves.
 */
export function useReviveAsk(w: World): { open: boolean; dismiss: () => void } {
  const [waved, setWaved] = useState<World['fallen']>(null);
  const open = !w.encounter && w.fallen !== waved && reviveOffered(healerView(w, data));
  return { open, dismiss: () => setWaved(w.fallen) };
}

/** The popup that asks, over the view, before the party moves on. */
export function RevivePopOut(props: { world: World; onChange: () => void; onLeave: () => void }) {
  return (
    <PopOut label="Revive the Fallen" modal>
      <HealerPanel world={props.world} onChange={props.onChange} onLeave={props.onLeave} />
    </PopOut>
  );
}
