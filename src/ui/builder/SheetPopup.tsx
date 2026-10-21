import { useRef } from 'preact/hooks';
import type { Character } from '../../data/schemas/index.ts';
import { useDialog } from '../dialog.ts';
import { CharacterSheet } from './Sheet.tsx';

/**
 * A character's sheet over the character list, scrolling on its own. Close, Escape, or a click on
 * the dimmed list around it closes it, and focus goes back to whatever opened it.
 */
export function SheetPopup(props: {
  character: Character;
  /** Where focus goes back to on closing; whatever had focus, if not given. */
  returnTo?: HTMLElement | null;
  onClose: () => void;
}) {
  const box = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  /** Whether the press began on the dim, so a drag out of the sheet doesn't close it. */
  const pressedOutside = useRef(false);
  useDialog({ box, focus: close, returnTo: props.returnTo, onEscape: props.onClose, trap: true });
  return (
    <div
      class="sheet-popup-backdrop"
      onMouseDown={(e) => (pressedOutside.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (pressedOutside.current && e.target === e.currentTarget) props.onClose();
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
          <button type="button" ref={close} onClick={props.onClose}>
            Close
          </button>
        </div>
        <CharacterSheet character={props.character} />
      </section>
    </div>
  );
}
