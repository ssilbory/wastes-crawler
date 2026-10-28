import { useEffect, useRef, useState } from 'preact/hooks';
import type { World } from '../../game/world/types.ts';
import {
  addAlerts,
  alertSnapshot,
  alertsSince,
  type Alert,
  type AlertSnapshot,
  type Shown,
} from '../../render/alert-view.ts';
import { data } from '../builder/data.ts';

/**
 * How long a notice stays up, and how many stack at once (the oldest gives way). The strain window
 * stays until dismissed.
 */
const LIFE_MS = 10_000;
const MOST = 5;
const ICONS: Record<Alert['kind'], string> = { strain: '⚠', quest: '✦', inn: '♪' };

/**
 * The notices beside the screen. `track` runs after every change to the world and raises a notice
 * for each thing that changed (alert-view.ts); `fresh` marks a world just opened, which raises none.
 */
export function useAlerts() {
  const last = useRef<AlertSnapshot | null>(null);
  const ids = useRef(0);
  const [shown, setShown] = useState<Shown[]>([]);
  const track = (w: World, fresh = false) => {
    const before = last.current;
    last.current = alertSnapshot(w);
    if (fresh || !before) return;
    const found = alertsSince(before, w, data);
    if (found.length === 0) return;
    setShown((s) => {
      const next = addAlerts(s, found, ids.current, MOST);
      ids.current = next.nextId;
      return next.shown;
    });
  };
  const dismiss = (id: number) => setShown((s) => s.filter((a) => a.id !== id));
  return { shown, track, dismiss };
}

export function Toasts(props: { shown: Shown[]; onDismiss: (id: number) => void }) {
  return (
    <div class="toasts" aria-live="polite">
      {props.shown.map((a) => (
        <Toast key={a.id} alert={a} onDismiss={() => props.onDismiss(a.id)} />
      ))}
    </div>
  );
}

function Toast(props: { alert: Shown; onDismiss: () => void }) {
  const { alert } = props;
  const entries = alert.entries;
  useEffect(() => {
    // The strain window waits to be dismissed; the others go by themselves.
    if (entries) return;
    const timer = setTimeout(props.onDismiss, LIFE_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div class={`toast toast-${alert.kind}`} role="status" aria-label={alert.title}>
      <span class="toast-icon" aria-hidden="true">
        {ICONS[alert.kind]}
      </span>
      <div>
        <h3>{alert.title}</h3>
        {alert.text && <p>{alert.text}</p>}
        {entries && (
          <ul class="toast-entries">
            {entries.map((e, i) => (
              <li key={entries.length - i}>
                <strong>{e.title}</strong> {e.text}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" class="toast-close" aria-label="Dismiss" onClick={props.onDismiss}>
        ✕
      </button>
    </div>
  );
}
