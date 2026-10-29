import { useState } from 'preact/hooks';
import type { KeyRow } from '../../render/key-help.ts';
import { useKeys } from '../keys.ts';
import { SheetDialog } from './SheetDialog.tsx';

/** A Keys button, and `?`, for the list of keys this screen answers to (render/key-help.ts). */
export function KeyHelp(props: { rows: readonly KeyRow[] }) {
  const [open, setOpen] = useState(false);
  useKeys({ '?': () => setOpen(true) });
  return (
    <>
      <button
        type="button"
        class="secondary"
        aria-keyshortcuts="Shift+?"
        onClick={() => setOpen(true)}
      >
        Keys
      </button>
      {open && (
        <SheetDialog title="Keys" onClose={() => setOpen(false)}>
          <table class="key-help">
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Does</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((r) => (
                <tr key={r.keys + r.does}>
                  <td>
                    <kbd>{r.keys}</kbd>
                  </td>
                  <td>{r.does}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SheetDialog>
      )}
    </>
  );
}
