import { useState } from 'preact/hooks';
import { MAX_GOAL, MAX_NAME } from '../../game/character/choices.ts';
import type { RosterEntry } from '../../game/character/roster.ts';
import { saveLabel } from './Builder.tsx';
import { CharacterSheet } from './Sheet.tsx';

/** A levelled character's name and goal, the only things that change once they have played. */
export function DetailsForm(props: {
  entry: RosterEntry;
  /** Why it couldn't be saved, or null once it is. */
  onSave: (details: { name: string; goal: string }) => string | null;
  onCancel: () => void;
}) {
  const c = props.entry.character;
  const [name, setName] = useState(c.name);
  const [goal, setGoal] = useState(c.goal);
  const [error, setError] = useState<string | null>(null);
  return (
    <div class="builder">
      <header>
        <h1>Editing {c.name}</h1>
        <button type="button" class="secondary" onClick={props.onCancel}>
          Back to characters
        </button>
      </header>
      <p class="hint">
        {c.name} has gained experience, so only their name and goal can change here.
      </p>
      {error && (
        <ul class="errors" role="alert">
          <li>{error}</li>
        </ul>
      )}
      <main class="done">
        <label class="field">
          <span>Name</span>
          <input
            type="text"
            maxLength={MAX_NAME}
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="field">
          <span>Goal</span>
          <input
            type="text"
            maxLength={MAX_GOAL}
            value={goal}
            onInput={(e) => setGoal((e.target as HTMLInputElement).value)}
          />
        </label>
        <div class="actions">
          <button
            type="button"
            class="create"
            onClick={() => setError(props.onSave({ name, goal }))}
          >
            {saveLabel(props.entry, name)}
          </button>
        </div>
        <CharacterSheet character={c} />
      </main>
    </div>
  );
}
