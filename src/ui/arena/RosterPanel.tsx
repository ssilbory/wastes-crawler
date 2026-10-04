import { DEFAULT_PRESETS, type DefaultPreset } from '../../data/schemas/index.ts';
import type { RosterEntry } from '../../game/character/roster.ts';
import { PRESET_NAMES } from '../../game/combat/defaults.ts';
import { className } from '../builder/data.ts';

const level = (e: RosterEntry) =>
  Object.values(e.character.classes.levels).reduce((sum, n) => sum + n, 0);

/** Saved characters: import more, remove them, and set each one's default action. */
export function RosterPanel(props: {
  entries: RosterEntry[];
  onImport: (files: FileList) => void;
  onRemove: (id: string) => void;
  onPreset: (id: string, preset: DefaultPreset) => void;
}) {
  return (
    <section class="panel roster" aria-label="Roster">
      <h2>Roster</h2>
      <label class="import">
        <span>Import character files</span>
        <input
          type="file"
          multiple
          accept="application/json,.json"
          onChange={(e) => {
            const input = e.target as HTMLInputElement;
            if (input.files) props.onImport(input.files);
            input.value = '';
          }}
        />
      </label>
      {props.entries.length === 0 ? (
        <p class="hint">
          No saved characters yet. Import character files, or make one in the{' '}
          <a href="#/builder">character builder</a> and save it to the roster.
        </p>
      ) : (
        <ul class="roster-list">
          {props.entries.map((e) => (
            <li key={e.id}>
              <span class="who">
                <strong>{e.character.name}</strong>, level {level(e)}{' '}
                {className(e.character.classes.current)}
              </span>
              <label>
                Default{' '}
                <select
                  aria-label={`Default action for ${e.character.name}`}
                  value={e.defaultAction}
                  onChange={(ev) =>
                    props.onPreset(e.id, (ev.target as HTMLSelectElement).value as DefaultPreset)
                  }
                >
                  {DEFAULT_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {PRESET_NAMES[p]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                class="secondary"
                aria-label={`Remove ${e.character.name}`}
                onClick={() => props.onRemove(e.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
