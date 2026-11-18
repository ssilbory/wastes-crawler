import { useEffect, useRef, useState } from 'preact/hooks';

/** One line of a screen's own ☰ menu; `rule` draws a line above it. */
export type MenuItem = { id: string; label: string; rule?: boolean };

/** What a screen puts in the ☰ menu in place of the list of sections (AppMenu.tsx). */
export type ScreenMenu = { items: MenuItem[]; onPick: (id: string) => void };

let current: ScreenMenu | null = null;
const listeners = new Set<() => void>();

function set(menu: ScreenMenu | null): void {
  current = menu;
  for (const hear of listeners) hear();
}

/** The menu of the screen now showing, or null where the ☰ menu lists the sections. */
export function useScreenMenu(): ScreenMenu | null {
  const [menu, setMenu] = useState(current);
  useEffect(() => {
    const hear = () => setMenu(current);
    listeners.add(hear);
    hear();
    return () => {
      listeners.delete(hear);
    };
  }, []);
  return menu;
}

/** Puts a screen's own items in the ☰ menu while it is mounted. */
export function useProvideScreenMenu(items: MenuItem[], onPick: (id: string) => void): void {
  const pick = useRef(onPick);
  pick.current = onPick;
  // Only a change to the list itself redraws the menu.
  const key = JSON.stringify(items);
  useEffect(() => {
    set({ items: JSON.parse(key) as MenuItem[], onPick: (id) => pick.current(id) });
  }, [key]);
  useEffect(() => () => set(null), []);
}
