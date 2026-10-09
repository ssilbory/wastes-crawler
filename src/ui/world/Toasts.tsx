import { useEffect, useRef, useState } from 'preact/hooks';
import type { World } from '../../game/world/types.ts';
import {
  alertSnapshot,
  alertsSince,
  type Alert,
  type AlertSnapshot,
} from '../../render/alert-view.ts';
import { data } from '../builder/data.ts';

type Shown = Alert & { id: number };

/** How long a notice stays up, and how many stack at once (the oldest gives way). */
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
    const found = alertsSince(before, w, data).map((a) => ({ ...a, id: ids.current++ }));
    if (found.length > 0) setShown((s) => [...s, ...found].slice(-MOST));
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

function Toast(props: { alert: Alert; onDismiss: () => void }) {
  const { alert } = props;
  useEffect(() => {
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
      </div>
      <button type="button" class="toast-close" aria-label="Dismiss" onClick={props.onDismiss}>
        ✕
      </button>
    </div>
  );
}
