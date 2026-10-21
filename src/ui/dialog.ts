import type { RefObject } from 'preact';
import { useLayoutEffect } from 'preact/hooks';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Open dialogs, oldest first: only the newest answers Escape and Tab. */
const stack: object[] = [];

/**
 * Focus for a dialog while it is mounted: it moves to `focus` (or the box) on opening and goes
 * back to `returnTo` (or whatever had it) on closing. With `onEscape`, Escape closes it; with
 * `trap`, Tab and Shift+Tab cycle inside it. A dialog opened over another (an ⓘ description over a
 * character sheet) takes the keys until it closes.
 */
export function useDialog(opts: {
  box: RefObject<HTMLElement>;
  focus?: RefObject<HTMLElement> | undefined;
  returnTo?: HTMLElement | null | undefined;
  onEscape?: (() => void) | undefined;
  trap?: boolean;
}): void {
  const { box, focus, returnTo, onEscape, trap = false } = opts;
  // Before paint, so Escape works the moment the dialog shows.
  useLayoutEffect(() => {
    const self = {};
    stack.push(self);
    const opener = returnTo ?? (document.activeElement as HTMLElement | null);
    (focus?.current ?? box.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (stack.at(-1) !== self) return;
      if (e.key === 'Escape' && onEscape) onEscape();
      if (e.key === 'Tab' && trap) trapTab(e, box.current);
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(self), 1);
      opener?.focus();
    };
  }, [box, focus, returnTo, onEscape, trap]);
}

/** Keeps Tab and Shift+Tab cycling inside the dialog, away from the page it covers. */
function trapTab(e: KeyboardEvent, box: HTMLElement | null): void {
  if (!box) return;
  // Only what can take focus: the ⓘ buttons are hidden with a mouse.
  const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0 && !el.hasAttribute('disabled'),
  );
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
