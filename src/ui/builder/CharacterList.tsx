import { useCallback, useRef, useState } from 'preact/hooks';
import type { RosterEntry } from '../../game/character/roster.ts';
import { characterLevel } from '../../rules/progression.ts';
import { ConfirmButton } from '../confirm.tsx';
import { className } from './data.ts';
import { download } from './download.ts';
import { SheetPopup } from './SheetPopup.tsx';

/** The saved characters, each with its sheet, an edit, an export, and a confirmed delete. */
export function CharacterList(props: {
  entries: RosterEntry[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);
  // Some browsers don't focus a clicked button, so the popup is told where focus goes back.
  const opener = useRef<HTMLElement | null>(null);
  const shown = props.entries.find((e) => e.id === open);
  return (
    <>
      <ul class="character-list" aria-label="Saved characters">
        {props.entries.map((e) => {
          const c = e.character;
          return (
            <li key={e.id}>
              <div class="character-row">
                <span class="who">
                  <strong>{c.name}</strong>, level {characterLevel(c.classes)}{' '}
                  {className(c.classes.current)}
                </span>
                <span class="row-actions">
                  <button
                    type="button"
                    class="secondary"
                    aria-haspopup="dialog"
                    aria-label={`${c.name}'s sheet`}
                    onClick={(ev) => {
                      opener.current = ev.currentTarget;
                      setOpen(e.id);
                    }}
                  >
                    Sheet
                  </button>
                  <button
                    type="button"
                    aria-label={`Edit ${c.name}`}
                    onClick={() => props.onEdit(e.id)}
                  >
                    Edit
                  </button>
                  <button type="button" aria-label={`Export ${c.name}`} onClick={() => download(c)}>
                    Export
                  </button>
                  <ConfirmButton
                    class="secondary"
                    label={`Delete ${c.name}`}
                    confirm={`Delete ${c.name} for good`}
                    onConfirm={() => props.onDelete(e.id)}
                  >
                    Delete
                  </ConfirmButton>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {shown && (
        <SheetPopup character={shown.character} returnTo={opener.current} onClose={close} />
      )}
    </>
  );
}
