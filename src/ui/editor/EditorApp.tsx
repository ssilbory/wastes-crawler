import { useMemo, useState } from 'preact/hooks';
import type { Dungeon, EditorLibrary } from '../../data/schemas/index.ts';
import { newDungeon } from '../../game/dungeon/dungeon-edit.ts';
import {
  deleteDungeon,
  importDungeons,
  saveDungeon,
  slug,
  uniqueId,
  withLibrary,
} from '../../game/editor/library.ts';
import { freeHex } from '../../game/editor/map-edit.ts';
import { playableContent } from '../../game/editor/playable.ts';
import { data, shippedContent } from '../builder/data.ts';
import { loadLibrary, saveLibrary } from '../editor-store.ts';
import '../world/world.css';
import '../world/dungeon-view.css';
import '../world/dungeon-props.css';
import './editor.css';
import { LevelEditor } from './LevelEditor.tsx';
import { readText, unreadable } from '../storage.ts';

/** What the editor can tell the author about saving. */
export interface Saving {
  /** The dungeon is in the shipped content. */
  shipped: boolean;
  /** A copy is saved in the browser. */
  saved: boolean;
  /** Why the saved copy isn't in the game, or null when it is (or nothing is saved). */
  notPlayable: string | null;
  save: (d: Dungeon) => void;
  /** Drops the saved copy, back to the shipped dungeon or gone. */
  discard: () => void;
  /** Saves under a new id and name, and edits that. */
  saveAs: (d: Dungeon) => void;
}

/**
 * The level editor (docs/decisions/0003-level-authoring.md): edit, validate, walk, export, and
 * (Sam's call) save dungeons in the browser and start new ones.
 */
export function EditorApp() {
  const [loaded] = useState(loadLibrary);
  const [lib, setLib] = useState<EditorLibrary>(loaded.library);
  const [message, setMessage] = useState<string | null>(loaded.errors.join('; ') || null);
  const content = withLibrary(shippedContent, lib);
  const dungeons = content.dungeons;
  const [dungeonId, setDungeonId] = useState(dungeons[0]?.id ?? '');
  // Bumped to start the editor afresh from what is saved.
  const [generation, setGeneration] = useState(0);
  const skipped = useMemo(() => playableContent(data.srd, shippedContent, lib).skipped, [lib]);
  const original = dungeons.find((d) => d.id === dungeonId) ?? dungeons[0];

  const store = (next: EditorLibrary, done: string) => {
    setLib(next);
    setMessage(saveLibrary(next) ? done : 'Browser storage is unavailable; nothing was saved.');
  };
  const pick = (id: string) => {
    setDungeonId(id);
    setGeneration(generation + 1);
  };
  const ids = () => dungeons.map((d) => d.id);
  const create = () => {
    const region = content.regions[0];
    const taken = dungeons.filter((d) => d.region === region?.id).map((d) => d.entrance);
    const at = region && freeHex(content.terrains, region, taken);
    if (!region || !at) return setMessage('There is no free hex on the first map for a dungeon.');
    const id = uniqueId('new-dungeon', ids());
    const d = newDungeon(id, 'New dungeon', region, at);
    store(saveDungeon(lib, d), `Created and saved ${d.name}.`);
    pick(id);
  };
  const onImport = async (file: File) => {
    const text = await readText(file);
    if (text === null) return setMessage(unreadable(file));
    const { dungeons: found, errors } = importDungeons(text);
    let next = lib;
    for (const d of found) next = saveDungeon(next, d);
    if (found.length > 0) {
      store(
        next,
        `Imported ${found.map((d) => d.name).join(', ')}.${errors.length ? ` ${errors.join('; ')}` : ''}`,
      );
      pick((found[0] as Dungeon).id);
    } else setMessage(errors.join('; '));
  };

  const head = (
    <div class="editor-bar">
      <label>
        Dungeon{' '}
        <select value={original?.id} onChange={(e) => pick((e.target as HTMLSelectElement).value)}>
          {dungeons.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {lib.dungeons.some((s) => s.id === d.id) ? ' (saved)' : ''}
            </option>
          ))}
        </select>
      </label>{' '}
      <button type="button" onClick={create}>
        New dungeon
      </button>{' '}
      <label class="button-like">
        Import…{' '}
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Import dungeons"
          onChange={(e) => {
            const input = e.target as HTMLInputElement;
            const file = input.files?.[0];
            if (file) void onImport(file);
            input.value = '';
          }}
        />
      </label>
      {message && (
        <span class="hint" role="status">
          {message}
        </span>
      )}
    </div>
  );
  if (!original)
    return (
      <main class="editor">
        <h1>Level editor</h1>
        {head}
        <p class="hint">There are no dungeons to edit.</p>
      </main>
    );
  const shipped = shippedContent.dungeons.some((d) => d.id === original.id);
  const saving: Saving = {
    shipped,
    saved: lib.dungeons.some((d) => d.id === original.id),
    notPlayable: skipped[original.id] ?? null,
    save: (d) => store(saveDungeon(lib, d), `Saved ${d.name} in this browser.`),
    discard: () => {
      store(
        deleteDungeon(lib, original.id),
        shipped ? `Back to the shipped ${original.name}.` : `Deleted ${original.name}.`,
      );
      pick(shipped ? original.id : (shippedContent.dungeons[0]?.id ?? ''));
    },
    saveAs: (d) => {
      store(saveDungeon(lib, d), `Saved a copy as ${d.name}.`);
      pick(d.id);
    },
  };
  return (
    <main class="editor">
      <h1>Level editor</h1>
      {head}
      <LevelEditor
        key={`${original.id}#${generation}`}
        original={original}
        content={content}
        saving={saving}
        newId={(name) => uniqueId(slug(name, 'dungeon'), ids())}
      />
    </main>
  );
}
