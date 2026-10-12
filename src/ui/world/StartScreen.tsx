import { useState } from 'preact/hooks';
import type { RosterEntry } from '../../game/character/roster.ts';
import { MAX_PCS, type Recruit } from '../../game/world/new-world.ts';
import { PartySetup, type Placement } from '../arena/PartySetup.tsx';
import { RosterList } from './RosterList.tsx';
import { playableWorld, WorldPicker } from './WorldPicker.tsx';
import type { Region } from '../../data/schemas/index.ts';
import { SLOTS, type Slot } from '../storage.ts';

/**
 * Starting a new world from the roster, on the campaign or a custom map, continuing a saved one, or
 * loading a save file.
 */
export function StartScreen(props: {
  roster: RosterEntry[];
  /** Each slot's one-line summary, and the slot chosen. */
  slots: Record<Slot, string>;
  slot: Slot;
  onSlot: (slot: Slot) => void;
  hasSave: boolean;
  errors: string[];
  onContinue: () => void;
  onNew: (party: Recruit[], seed: string, map: Region | null) => void;
  /** Adds the starter party to the roster and returns where its members stand. */
  onStarters: () => Placement;
  onImport: (file: File) => void;
  onDelete: (id: string) => void;
}) {
  const [placement, setPlacement] = useState<Placement>({});
  const [seed, setSeed] = useState('');
  const [map, setMap] = useState<Region | null>(null);
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
          <span>Load a save file</span>
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
      <fieldset class="slots">
        <legend>Save slot</legend>
        {SLOTS.map((n) => (
          <label key={n}>
            <input
              type="radio"
              name="slot"
              checked={props.slot === n}
              onChange={() => props.onSlot(n)}
            />{' '}
            Slot {n}: {props.slots[n]}
          </label>
        ))}
      </fieldset>
      <WorldPicker onChange={setMap} />
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
            The roster is empty. Use the starter party, make characters in the{' '}
            <a href="#/builder">character builder</a>, or import them in the{' '}
            <a href="#/arena">arena</a>.
          </p>
        ) : (
          <PartySetup entries={props.roster} placement={placement} onChange={setPlacement} />
        )}
        <RosterList
          entries={props.roster}
          onDelete={(id) => {
            setPlacement(
              Object.fromEntries(Object.entries(placement).filter(([, placed]) => placed !== id)),
            );
            props.onDelete(id);
          }}
        />
      </main>
      <div class="start-row">
        <label>
          Seed (optional){' '}
          <input value={seed} onInput={(e) => setSeed((e.target as HTMLInputElement).value)} />
        </label>
        <button type="button" onClick={() => setPlacement(props.onStarters())}>
          Use the starter party
        </button>
        {party.length > MAX_PCS && <span class="hint">A party holds {MAX_PCS} PCs.</span>}
        <button
          type="button"
          class="create"
          disabled={party.length === 0 || party.length > MAX_PCS || !playableWorld(map)}
          onClick={() => props.onNew(party, seed, map)}
        >
          {props.hasSave ? 'Start a new world (replaces the save)' : 'Start a new world'}
        </button>
      </div>
    </div>
  );
}
