import { useState } from 'preact/hooks';
import type { RosterEntry } from '../../game/character/roster.ts';
import type { Recruit } from '../../game/world/new-world.ts';
import { PartySetup, type Placement } from '../arena/PartySetup.tsx';

/** Starting a new world from the roster, continuing the saved one, or loading a save file. */
export function StartScreen(props: {
  roster: RosterEntry[];
  hasSave: boolean;
  errors: string[];
  onContinue: () => void;
  onNew: (party: Recruit[], seed: string) => void;
  onImport: (file: File) => void;
}) {
  const [placement, setPlacement] = useState<Placement>({});
  const [seed, setSeed] = useState('');
  const party: Recruit[] = Object.entries(placement).flatMap(([key, id]) => {
    const entry = props.roster.find((e) => e.id === id);
    const [row, column] = key.split('-').map(Number) as [number, number];
    return entry
      ? [{ character: entry.character, row, column, defaultAction: entry.defaultAction }]
      : [];
  });
  return (
    <div class="arena">
      <header>
        <h1>Overland</h1>
        {props.hasSave && (
          <button type="button" class="create" onClick={props.onContinue}>
            Continue journey
          </button>
        )}
        <label class="import">
          <span>Load a world save</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const input = e.target as HTMLInputElement;
              const file = input.files?.[0];
              if (file) props.onImport(file);
              input.value = '';
            }}
          />
        </label>
      </header>
      {props.errors.length > 0 && (
        <ul class="errors" role="alert">
          {props.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <main class="arena-setup">
        {props.roster.length === 0 ? (
          <p class="hint">
            The roster is empty. Make characters in the <a href="#/builder">character builder</a> or
            import them in the <a href="#/arena">arena</a>, then come back to set out.
          </p>
        ) : (
          <PartySetup entries={props.roster} placement={placement} onChange={setPlacement} />
        )}
      </main>
      <div class="start-row">
        <label>
          Seed (optional){' '}
          <input value={seed} onInput={(e) => setSeed((e.target as HTMLInputElement).value)} />
        </label>
        <button
          type="button"
          class="create"
          disabled={party.length === 0}
          onClick={() => props.onNew(party, seed)}
        >
          {props.hasSave ? 'Start a new world (replaces the save)' : 'Start a new world'}
        </button>
      </div>
    </div>
  );
}
