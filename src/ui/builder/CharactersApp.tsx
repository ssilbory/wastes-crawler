import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Character } from '../../data/schemas/index.ts';
import { emptyChoices } from '../../game/character/creation.ts';
import { importCharacter } from '../../game/character/io.ts';
import {
  removeFromRoster,
  type LoadedRoster,
  type RosterEntry,
} from '../../game/character/roster.ts';
import {
  editPlan,
  importToRoster,
  saveBuilt,
  saveDetails,
  sameName,
} from '../../game/character/roster-edit.ts';
import { ConfirmButton } from '../confirm.tsx';
import { activeSlot, loadRoster, loadWorldText, saveRoster } from '../storage.ts';
import { launchHash } from '../world/launch.ts';
import { Builder } from './Builder.tsx';
import { CharacterList } from './CharacterList.tsx';
import { data, freshRng } from './data.ts';
import { DetailsForm } from './DetailsForm.tsx';

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; id: string };

/** `#/builder` lists the characters, `#/builder/new` makes one, `#/builder/edit/<id>` edits one. */
function viewOf(hash: string): View {
  if (hash === '#/builder/new') return { kind: 'new' };
  const edit = /^#\/builder\/edit\/(.+)$/.exec(hash);
  if (!edit) return { kind: 'list' };
  try {
    return { kind: 'edit', id: decodeURIComponent(edit[1] as string) };
  } catch {
    // A mangled id in the address names no character.
    return { kind: 'list' };
  }
}

const go = (hash: string) => {
  location.hash = hash;
};

const UNSAVED = 'Browser storage is unavailable, so nothing was saved.';
const REPICK =
  'so the builder starts from what their sheet shows. Pick their background, foci, magic, free ' +
  'skill, and gear again; saving replaces their skills, gear, and crowns with these picks.';
const NOTICES = {
  missing: `The builder has no picks saved for this character, ${REPICK}`,
  stale: `This character's saved picks no longer build them as they are, ${REPICK}`,
};

const saveMessage = (original: Character, name: string) =>
  sameName(original.name, name) ? `${name.trim()} is saved.` : `${name.trim()} joined the roster.`;

/** The character page: make, import, edit, export, and delete saved characters. */
export function CharactersApp() {
  const [view, setView] = useState<View>(() => viewOf(location.hash));
  useEffect(() => {
    const onHash = () => setView(viewOf(location.hash));
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  const [roster, setRoster] = useState<LoadedRoster>(loadRoster);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const { entries } = roster;

  /**
   * Applies a change to the roster as stored now, so characters another tab added survive, then
   * shows the list with `message`; false if storage is unavailable.
   */
  const store = (change: (current: RosterEntry[]) => RosterEntry[], message: string) => {
    const current = loadRoster();
    const next = change(current.entries);
    if (!saveRoster(next)) return false;
    setRoster({ ...current, entries: next });
    setStatus(message);
    setErrors([]);
    go('#/builder');
    return true;
  };
  const open = (hash: string) => {
    setStatus(null);
    setErrors([]);
    go(hash);
  };

  const editing = view.kind === 'edit' ? entries.find((e) => e.id === view.id) : undefined;
  const plan = useMemo(() => editing && editPlan(editing, data), [editing]);
  const back = () => go('#/builder');

  if (view.kind === 'new')
    return (
      <Builder
        initial={emptyChoices()}
        onSave={(c, choices) =>
          store((now) => saveBuilt(now, c, choices), `${c.name} joined the roster.`)
        }
        onCancel={back}
      />
    );
  if (editing && plan?.kind === 'wizard')
    return (
      <Builder
        key={editing.id}
        initial={plan.choices}
        original={editing}
        notice={plan.recovered ? NOTICES[plan.recovered] : undefined}
        onSave={(c, choices) =>
          store(
            (now) => saveBuilt(now, c, choices, editing),
            saveMessage(editing.character, c.name),
          )
        }
        onCancel={back}
      />
    );
  if (editing && plan?.kind === 'details')
    return (
      <DetailsForm
        key={editing.id}
        entry={editing}
        onSave={(details) => {
          const checked = saveDetails(entries, editing, details, freshRng());
          if (!checked.ok) return checked.reason;
          const rng = freshRng();
          const saved = store(
            (now) => {
              const r = saveDetails(now, editing, details, rng);
              return r.ok ? r.entries : now;
            },
            saveMessage(editing.character, details.name),
          );
          return saved ? null : UNSAVED;
        }}
        onCancel={back}
      />
    );

  const onImport = async (input: HTMLInputElement) => {
    const files = [...(input.files ?? [])];
    input.value = '';
    const imported: Character[] = [];
    const problems: string[] = [];
    for (const file of files) {
      const result = importCharacter(await file.text(), data);
      if (result.ok) imported.push(result.character);
      else problems.push(...result.errors.map((e) => `${file.name}: ${e}`));
    }
    const rng = freshRng();
    const names = imported.map((c) => c.name).join(', ');
    const add = (now: RosterEntry[]) => imported.reduce((r, c) => importToRoster(r, c, rng), now);
    if (imported.length > 0 && !store(add, `${names} joined the roster.`)) problems.push(UNSAVED);
    if (imported.length === 0) setStatus(null);
    setErrors(problems);
  };

  return (
    <div class="builder characters">
      <header>
        <h1>Characters</h1>
        <button type="button" class="create" onClick={() => open('#/builder/new')}>
          New character
        </button>
        <label class="import">
          <span>Import character files</span>
          <input
            type="file"
            multiple
            accept="application/json,.json"
            onChange={(e) => void onImport(e.target as HTMLInputElement)}
          />
        </label>
      </header>
      {view.kind === 'edit' && !editing && (
        <p class="hint">That character isn’t in the roster any more.</p>
      )}
      {status && (
        <p class="saved" role="status">
          {status}
        </p>
      )}
      {errors.length > 0 && (
        <ul class="errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {roster.errors.length > 0 && <p class="hint">Saved roster: {roster.errors.join('; ')}.</p>}
      <main>
        {entries.length === 0 ? (
          <EmptyRoster onNew={() => open('#/builder/new')} />
        ) : (
          <CharacterList
            entries={entries}
            onEdit={(id) => open(`#/builder/edit/${encodeURIComponent(id)}`)}
            onDelete={(id) => {
              const e = entries.find((x) => x.id === id) as RosterEntry;
              if (!store((now) => removeFromRoster(now, id), `${e.character.name} is deleted.`))
                setErrors([UNSAVED]);
            }}
          />
        )}
        {entries.length > 0 && (
          <p class="hint">
            Take them into the <a href="#/world">Overland</a> or the <a href="#/arena">arena</a>.
            Editing or deleting a character here leaves any saved world they travel in alone.
          </p>
        )}
      </main>
    </div>
  );
}

/**
 * The roster before anyone is in it: the three ways to get characters, as actions rather than a
 * line of text. Setting out with the starter party asks first when it would replace a saved world.
 */
function EmptyRoster(props: { onNew: () => void }) {
  const slot = activeSlot();
  const saved = loadWorldText(slot) !== null;
  return (
    <section class="panel empty-roster" aria-label="The roster is empty">
      <h2>The roster is empty</h2>
      <div class="empty-roster-actions">
        <button type="button" class="create" onClick={props.onNew}>
          Make a character
        </button>
        <ConfirmButton
          ask={saved}
          confirm={`Replace slot ${slot}`}
          onConfirm={() => {
            location.hash = launchHash('starters');
          }}
        >
          Set out with the starter party
        </ConfirmButton>
      </div>
      <p class="hint">Or bring in characters saved before with Import character files, above.</p>
    </section>
  );
}
