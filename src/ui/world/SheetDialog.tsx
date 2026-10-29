import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { useDialog } from '../dialog.ts';

/**
 * A sheet over the whole screen for reading at length: the keys, the full journal. Close, Escape,
 * or a press that begins and ends on the dim around it closes it, and focus goes back to what
 * opened it.
 */
export function SheetDialog(props: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}) {
  const box = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  /** Whether the press began on the dim, so a drag out of the sheet doesn't close it. */
  const pressedOutside = useRef(false);
  useDialog({ box, focus: close, onEscape: props.onClose, trap: true });
  return (
    <div
      class="sheet-dialog-backdrop"
      onMouseDown={(e) => (pressedOutside.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (pressedOutside.current && e.target === e.currentTarget) props.onClose();
      }}
    >
      <section
        ref={box}
        class="sheet-dialog panel"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
      >
        <div class="sheet-dialog-bar">
          <h2>{props.title}</h2>
          <button type="button" ref={close} onClick={props.onClose}>
            Close
          </button>
        </div>
        {props.children}
      </section>
    </div>
  );
}
