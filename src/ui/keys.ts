import { useEffect, useRef } from 'preact/hooks';

/** Controls Space and Enter already press when focused. */
export const CONTROLS =
  'button, a, summary, [role="button"], [role="tab"], [role="radio"], [role="checkbox"]';

/**
 * Whether a key press is the page's to take as a shortcut: not typed into a text field or select,
 * not a Ctrl, Cmd, or Alt chord, not already handled, and not while a modal dialog owns the
 * keyboard. Space and Enter on a focused button, link, or tab press it, as
 * the browser does.
 */
export function isShortcut(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return false;
  const target = e.target as HTMLElement | null;
  if (target?.closest('input, select, textarea, [contenteditable]')) return false;
  if (document.querySelector('[aria-modal="true"]')) return false;
  return !((e.key === ' ' || e.key === 'Enter') && target?.closest(CONTROLS));
}

/**
 * Single-key shortcuts for a screen while it is mounted, keyed by `KeyboardEvent.key` (letters in
 * lower case). A key with no action, or undefined, does nothing. Keys typed into a text field or a
 * select, chords with Ctrl, Cmd, or Alt, and any key while a modal dialog is open (it owns the
 * keyboard) are left alone.
 */
export function useKeys(keys: Record<string, (() => void) | undefined>): void {
  const current = useRef(keys);
  current.current = keys;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A held key acts once: holding Q plays one quarter, not a day.
      if (e.repeat || !isShortcut(e)) return;
      const run = current.current[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!run) return;
      e.preventDefault();
      run();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
}
