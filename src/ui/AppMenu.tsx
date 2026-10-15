import { useEffect, useRef, useState } from 'preact/hooks';
import { fullscreenAvailable, toggleFullscreen, useFullscreen } from './fullscreen.ts';

export type Route = 'builder' | 'arena' | 'world' | 'editor' | 'maps' | 'settings' | 'about';

const ROUTES: { route: Route; label: string }[] = [
  { route: 'world', label: 'Overland' },
  { route: 'builder', label: 'Character builder' },
  { route: 'arena', label: 'Arena' },
  { route: 'editor', label: 'Level editor' },
  { route: 'maps', label: 'Map editor' },
  { route: 'settings', label: 'Settings' },
  { route: 'about', label: 'About' },
];

/** A ☰ button in the corner; the modes open in a popup instead of a bar across every page. */
export function AppMenu(props: { route: Route }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    addEventListener('keydown', onKey);
    addEventListener('click', onClick);
    return () => {
      removeEventListener('keydown', onKey);
      removeEventListener('click', onClick);
    };
  }, [open]);
  return (
    <div class="app-menu" ref={root}>
      <button
        type="button"
        class="app-menu-button"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="app-menu-list"
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">☰</span>
      </button>
      {open && (
        <nav id="app-menu-list" class="app-menu-list" aria-label="Sections">
          {ROUTES.map((r) => (
            <a
              key={r.route}
              href={`#/${r.route}`}
              aria-current={props.route === r.route ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {r.label}
            </a>
          ))}
          {fullscreenAvailable() && (
            <button
              type="button"
              class="app-menu-item"
              onClick={() => {
                setOpen(false);
                void toggleFullscreen();
              }}
            >
              {fullscreen ? 'Leave full screen' : 'Full screen'}
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
