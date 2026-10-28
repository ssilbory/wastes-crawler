// Installing and playing offline (docs/plan.md, Portability). The service worker is generated at
// build time by tools/pwa/service-worker.ts; it caches the whole game, so after one visit the game
// runs with no connection. Saves stay in browser storage, so this also asks the browser to keep
// that storage instead of clearing it when the phone runs low on space.
import { useEffect, useState } from 'preact/hooks';

/** Registers the service worker in a built game; the dev server has none. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // No service worker (a private window, or file://): the game still runs online.
    });
  });
}

/** The About page's saves section, scrolled to: where the overland's reminder links. */
export const SAVES_LINK = '#/about/saves';

/**
 * Whether the browser has promised to keep this site's storage, null if it won't say, and a call
 * that asks it to.
 */
export function usePersisted(): [boolean | null, () => void] {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);
  return [persisted, () => void persistStorage().then(setPersisted)];
}

/** Asks the browser not to evict saved games; true if it agreed. */
export async function persistStorage(): Promise<boolean> {
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Chrome's install prompt event, which TypeScript's DOM types don't include yet. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Catches the install prompt as early as possible, so the About page can offer it later. */
export function watchInstallPrompt(): void {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

/** Whether the game is running as an installed app rather than in a browser tab. */
export function installed(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** An install function while the browser offers one (Chrome and Edge), else null. */
export function useInstall(): (() => Promise<void>) | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  if (!deferred) return null;
  const prompt = deferred;
  return async () => {
    await prompt.prompt();
    await prompt.userChoice;
    deferred = null;
    notify();
  };
}
