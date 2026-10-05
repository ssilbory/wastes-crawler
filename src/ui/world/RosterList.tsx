import { useState } from 'preact/hooks';
import type { RosterEntry } from '../../game/character/roster.ts';
import { className } from '../builder/data.ts';

const level = (e: RosterEntry) =>
  Object.values(e.character.classes.levels).reduce((sum, n) => sum + n, 0);

/** The saved characters, each deletable after a confirmation. */
export function RosterList(props: { entries: RosterEntry[]; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  if (props.entries.length === 0) return null;
  return (
    <section class="panel roster" aria-label="Saved characters">
      <h2>Saved characters</h2>
      <p class="hint">Deleting a character here leaves any saved world they travel in alone.</p>
      <ul class="roster-list">
        {props.entries.map((e) => (
          <li key={e.id}>
            <span class="who">
              <strong>{e.character.name}</strong>, level {level(e)}{' '}
              {className(e.character.classes.current)}
            </span>
            {deleting === e.id ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDeleting(null);
                    props.onDelete(e.id);
                  }}
                >
                  Delete {e.character.name} for good
                </button>
                <button type="button" onClick={() => setDeleting(null)}>
                  Keep
                </button>
              </>
            ) : (
              <button type="button" class="secondary" onClick={() => setDeleting(e.id)}>
                Delete {e.character.name}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
