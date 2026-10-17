// Getting into and out of the Overland: the title screen's requests, and save files handed out.
import { useEffect } from 'preact/hooks';

/** What the title screen asks the Overland to do as it opens: `#/world/continue` or `#/world/starters`. */
export type Launch = 'continue' | 'starters';

export const launchHash = (launch: Launch) => `#/world/${launch}`;

/** Runs the title screen's request once, then drops it from the address so a reload doesn't repeat it. */
export function useLaunch(run: (launch: Launch) => void) {
  useEffect(() => {
    const asked = location.hash.slice('#/world/'.length);
    if (asked !== 'continue' && asked !== 'starters') return;
    history.replaceState(null, '', '#/world');
    run(asked);
  }, []);
}

/** Hands the player a save file. */
export function download(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wastes-crawler-save.json';
  a.click();
  URL.revokeObjectURL(url);
}
