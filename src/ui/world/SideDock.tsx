import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

// Whether the side column is minimized, kept in browser storage like the settings. Storage can be
// missing or blocked; then it lasts for the session.
const KEY = 'wastes-crawler.side-dock';

function stored(): boolean {
  try {
    return localStorage.getItem(KEY) === 'min';
  } catch {
    return false;
  }
}

let minimized = stored();

function remember(min: boolean): void {
  minimized = min;
  try {
    if (min) localStorage.setItem(KEY, 'min');
    else localStorage.removeItem(KEY);
  } catch {
    // Not kept; it still holds until the page reloads.
  }
}

/**
 * The column of quests, companions, and the other panels (Sam's ask). Minimized, it folds to a
 * strip with a button to bring it back, and the journal under the map shrinks too, so the map
 * grows both ways (layout.css).
 */
export function SideDock(props: { children: ComponentChildren }) {
  const [min, setMin] = useState(minimized);
  const toggle = () => {
    remember(!min);
    setMin(!min);
  };
  return min ? (
    <div class="dock side-dock minimized">
      <button
        type="button"
        class="dock-toggle secondary"
        aria-expanded="false"
        aria-label="Show the side panels"
        title="Show the side panels"
        onClick={toggle}
      >
        ‹
      </button>
    </div>
  ) : (
    <div class="dock side-dock">
      <button
        type="button"
        class="dock-toggle secondary"
        aria-expanded="true"
        aria-label="Minimize the side panels"
        title="Minimize the side panels"
        onClick={toggle}
      >
        ›
      </button>
      {props.children}
    </div>
  );
}
