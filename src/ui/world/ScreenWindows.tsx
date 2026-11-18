import type { RefObject } from 'preact';
import { useCallback, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useDialog } from '../dialog.ts';
import { useProvideScreenMenu, type MenuItem } from '../screen-menu.ts';
import type { PartyScreen } from './PartyButtons.tsx';
import { WINDOWS, type WindowProps } from './window-list.tsx';

/** The ☰ item that leaves the game's screens. */
const START = 'start';

/** The party's screens, in the menu as well as the bar: a phone's bar has no room for them. */
const SCREENS: { id: PartyScreen; label: string }[] = [
  { id: 'character', label: 'Characters' },
  { id: 'formation', label: 'Formation' },
  { id: 'inventory', label: 'Inventory' },
];

/** Focus and the keyboard for the open window, held only while one is open (dialog.ts). */
function WindowFocus(props: { box: RefObject<HTMLDivElement>; onEscape: () => void }) {
  useDialog({ box: props.box, trap: true, onEscape: props.onEscape });
  return null;
}

/**
 * A screen's panels as windows opened from the ☰ menu (Sam's call), on the overland map, in a
 * dungeon, and in a town, so the dock holds only what the party is doing now and nothing scrolls.
 * Every panel stays mounted, hidden until its window is opened, so each keeps what it was showing;
 * the menu lists only those with something in them. A window opens over an encounter too, as the
 * dock stayed in reach beside one (a countersign to look up, say).
 */
export function ScreenWindows(props: WindowProps) {
  const here = WINDOWS.filter((v) => v.on.includes(props.screen));
  const onOpen = props.onOpen;
  const [open, setOpen] = useState<string | null>(null);
  const [filled, setFilled] = useState<string[]>([]);
  const card = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);
  // A panel with nothing to say renders nothing, which is how the menu learns to leave it out.
  useLayoutEffect(() => {
    const now = [...(card.current?.querySelectorAll<HTMLElement>('[data-window]') ?? [])]
      .filter((el) => el.childElementCount > 0)
      .map((el) => el.dataset.window ?? '');
    if (now.join() !== filled.join()) setFilled(now);
    if (open !== null && !now.includes(open)) setOpen(null);
  });
  const windows = here.filter((v) => filled.includes(v.id));
  const items: MenuItem[] = [
    ...(onOpen ? SCREENS : []),
    ...windows.map((v, i) => ({ id: v.id, label: v.label, ...(i === 0 ? { rule: true } : {}) })),
    { id: START, label: 'Return to Overland start', rule: true },
  ];
  useProvideScreenMenu(items, (id) => {
    const screen = SCREENS.find((v) => v.id === id);
    if (screen) onOpen?.(screen.id);
    else if (id === START) props.onStart();
    else setOpen(id);
  });
  const shown = open !== null;
  return (
    <div
      class={shown ? 'pop-out map-window' : undefined}
      hidden={!shown}
      // A click on the dimmed screen about the window closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {shown && <WindowFocus box={card} onEscape={close} />}
      <div
        ref={card}
        class="pop-out-card"
        role="dialog"
        aria-label={here.find((v) => v.id === open)?.label ?? 'Window'}
        aria-modal={shown ? 'true' : undefined}
        tabIndex={-1}
      >
        {here.map((v) => (
          <div key={v.id} data-window={v.id} hidden={v.id !== open}>
            {v.body(props)}
          </div>
        ))}
        <div class="map-window-foot">
          <button type="button" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
