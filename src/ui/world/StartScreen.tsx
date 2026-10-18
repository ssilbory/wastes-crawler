import { useState } from 'preact/hooks';
import type { RosterEntry } from '../../game/character/roster.ts';
import { MAX_PCS, type Recruit } from '../../game/world/new-world.ts';
import { PartySetup, type Placement } from '../arena/PartySetup.tsx';
import { ConfirmButton } from '../confirm.tsx';
import { CAMPAIGN, playableWorld, WorldPicker, type WorldChoice } from './WorldPicker.tsx';
import { SLOTS, type Slot } from '../storage.ts';

/** The roster's characters where the party setup placed them. */
export function recruits(roster: RosterEntry[], placement: Placement): Recruit[] {
  return Object.entries(placement).flatMap(([key, id]) => {
    const entry = roster.find((e) => e.id === id);
    const [row, column] = key.split('-').map(Number) as [number, number];
    return entry
      ? [{ character: entry.character, row, column, defaultAction: entry.defaultAction }]
      : [];
  });
}

/**
 * Starting a new world from the roster, on the campaign, a realm, or a custom map, continuing a saved one, or
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
  onNew: (party: Recruit[], seed: string, choice: WorldChoice) => void;
  /** Adds the starter party to the roster and returns where its members stand. */
  onStarters: () => Placement;
  onImport: (file: File) => void;
}) {
  const [placement, setPlacement] = useState<Placement>({});
  const [seed, setSeed] = useState('');
  const [choice, setChoice] = useState<WorldChoice>(CAMPAIGN);
  /** A save file waiting on a yes before it replaces the slot's save. */
  const [pending, setPending] = useState<File | null>(null);
  const party = recruits(props.roster, placement);
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
              if (file && props.hasSave) setPending(file);
              else if (file) props.onImport(file);
              input.value = '';
            }}
          />
        </label>
      </header>
      {pending && (
        <p class="confirm-row" role="alert">
          Loading {pending.name} replaces the save in slot {props.slot}.{' '}
          <span class="confirm">
            <button
              type="button"
              class="danger"
              onClick={() => {
                setPending(null);
                props.onImport(pending);
              }}
            >
              Replace slot {props.slot}
            </button>
            <button type="button" onClick={() => setPending(null)}>
              Keep
            </button>
          </span>
        </p>
      )}
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
      <WorldPicker onChange={setChoice} />
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
            The roster is empty. Use the starter party, or make or import characters on the{' '}
            <a href="#/builder">Characters page</a>.
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
        <button type="button" onClick={() => setPlacement(props.onStarters())}>
          Use the starter party
        </button>
        {party.length > MAX_PCS && <span class="hint">A party holds {MAX_PCS} PCs.</span>}
        <ConfirmButton
          class="create"
          ask={props.hasSave}
          confirm={`Replace slot ${props.slot}`}
          disabled={party.length === 0 || party.length > MAX_PCS || !playableWorld(choice)}
          onConfirm={() => props.onNew(party, seed, choice)}
        >
          {props.hasSave ? 'Start a new world (replaces the save)' : 'Start a new world'}
        </ConfirmButton>
      </div>
      {party.length === 0 && (
        <p class="hint">Place at least one character in the party to start a new world.</p>
      )}
    </div>
  );
}
