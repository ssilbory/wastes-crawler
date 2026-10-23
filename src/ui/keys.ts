import { useEffect, useRef } from 'preact/hooks';

/** Controls Space already presses when focused. */
export const CONTROLS =
  'button, a, summary, [role="button"], [role="tab"], [role="radio"], [role="checkbox"]';

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
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, select, textarea, [contenteditable]')) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      // Space presses a focused button, link, or tab, as the browser does.
      if (e.key === ' ' && target?.closest(CONTROLS)) return;
      const run = current.current[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!run) return;
      e.preventDefault();
      run();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
}
