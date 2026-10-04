// The player's settings, kept in browser storage and shared by every screen. Storage can be
// missing or blocked, so the defaults stand in and changes last for the session.
import { useEffect, useState } from 'preact/hooks';
import type { Settings } from '../data/schemas/index.ts';
import { parseSettings, serializeSettings } from '../game/settings.ts';
import { data } from './builder/data.ts';

const KEY = 'wastes-crawler.settings';

function load(): Settings {
  try {
    return parseSettings(localStorage.getItem(KEY), data);
  } catch {
    return parseSettings(null, data);
  }
}

let current = load();
const listeners = new Set<(s: Settings) => void>();

/** Applies the settings that live on the page itself: the text size. */
function apply(s: Settings): void {
  document.documentElement.dataset.textSize = s.textSize;
}
apply(current);

export const getSettings = () => current;

export function setSettings(s: Settings): void {
  current = s;
  try {
    localStorage.setItem(KEY, serializeSettings(s));
  } catch {
    // Kept for this session only.
  }
  apply(s);
  for (const listen of listeners) listen(s);
}

export function useSettings(): Settings {
  const [s, set] = useState(current);
  useEffect(() => {
    listeners.add(set);
    return () => void listeners.delete(set);
  }, []);
  return s;
}
