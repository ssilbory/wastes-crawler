import { useLayoutEffect, useRef } from 'preact/hooks';
import type { Character } from '../../data/schemas/index.ts';
import { CharacterSheet } from './Sheet.tsx';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A character's sheet over the character list, scrolling on its own. Close, Escape, or a click on
 * the dimmed list around it closes it, and focus goes back to whatever opened it.
 */
export function SheetPopup(props: { character: Character; onClose: () => void }) {
  const box = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  /** Whether the press began on the dim, so a drag out of the sheet doesn't close it. */
  const pressedOutside = useRef(false);
  const { onClose } = props;
  // Before paint, so Escape works the moment the sheet shows.
  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // An ⓘ description over the sheet closes on its own first.
      if (e.key === 'Escape' && !document.querySelector('.hint-sheet')) onClose();
      if (e.key === 'Tab') trapTab(e, box.current);
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [onClose]);
  return (
    <div
      class="sheet-popup-backdrop"
      onMouseDown={(e) => (pressedOutside.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (pressedOutside.current && e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={box}
        class="sheet-popup panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${props.character.name}'s sheet`}
      >
        <div class="sheet-popup-bar">
          <button type="button" ref={close} onClick={onClose}>
            Close
          </button>
        </div>
        <CharacterSheet character={props.character} />
      </section>
    </div>
  );
}

/** Keeps Tab and Shift+Tab cycling inside the popup, away from the list it covers. */
function trapTab(e: KeyboardEvent, box: HTMLElement | null): void {
  if (!box) return;
  const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = items[0];
  const last = items.at(-1);
  if (!first || !last) return;
  const inside = box.contains(document.activeElement);
  if (e.shiftKey && (!inside || document.activeElement === first)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
    e.preventDefault();
    first.focus();
  }
}
