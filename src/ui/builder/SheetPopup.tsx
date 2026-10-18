import { useLayoutEffect, useRef } from 'preact/hooks';
import type { Character } from '../../data/schemas/index.ts';
import { CharacterSheet } from './Sheet.tsx';

/**
 * A character's sheet over the character list, scrolling on its own. Close, Escape, or a click on
 * the dimmed list beside it closes it, and focus goes back to whatever opened it.
 */
export function SheetPopup(props: { character: Character; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  const { onClose } = props;
  // Before paint, so Escape works the moment the sheet shows.
  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [onClose]);
  return (
    <div class="sheet-popup-backdrop" onClick={onClose}>
      <section
        class="sheet-popup panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${props.character.name}'s sheet`}
        onClick={(e) => e.stopPropagation()}
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
