import { useState } from 'preact/hooks';
import type { EditorLibrary, Region } from '../../data/schemas/index.ts';
import { saveRegion, slug, uniqueId } from '../../game/editor/library.ts';
import { generateRegion } from '../../game/editor/map-gen.ts';
import { worldMapErrors } from '../../game/editor/playable.ts';
import { createRng } from '../../rules/rng.ts';
import { data, freshRng, shippedContent } from '../builder/data.ts';
import { loadLibrary, saveLibrary } from '../editor-store.ts';

/** The world a new game is played on: a custom map, a shipped realm, or neither for the campaign. */
export interface WorldChoice {
  map: Region | null;
  realm: string | null;
}
export const CAMPAIGN: WorldChoice = { map: null, realm: null };

/**
 * Which world a new game is played on (Sam's calls): the campaign, a shipped realm, a world
 * shipped beside it, a map saved in the map editor, or a new random map made here and saved there.
 * Only the campaign has the campaign's story.
 */
export function WorldPicker(props: { onChange: (choice: WorldChoice) => void }) {
  const [lib, setLib] = useState<EditorLibrary>(() => loadLibrary().library);
  const [chosen, setChosen] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const realms = shippedContent.realms;
  const problems = (r: Region) => worldMapErrors(data.srd, shippedContent, r);
  const worlds = shippedContent.worlds;
  const choose = (id: string, maps = lib.regions) => {
    const realm = realms.find((r) => `realm:${r.id}` === id);
    const map = worlds.find((w) => w.map.id === id)?.map ?? maps.find((r) => r.id === id) ?? null;
    setChosen(realm || map ? id : '');
    props.onChange(realm ? { map: null, realm: realm.id } : { map, realm: null });
  };
  const create = () => {
    const title = name.trim() || 'New lands';
    const id = uniqueId(slug(title, 'world'), [
      ...shippedContent.regions.map((r) => r.id),
      ...worlds.map((w) => w.map.id),
      ...lib.regions.map((r) => r.id),
    ]);
    const map = generateRegion(shippedContent, createRng(freshRng().int(1, 999_999)), {
      id,
      name: title,
      ...shippedContent.mapGen.defaults,
    });
    const next = saveRegion(lib, map);
    setLib(next);
    setNote(
      saveLibrary(next)
        ? `Made ${title}. Change it in the map editor if you like.`
        : 'Browser storage is unavailable; the new world won’t be kept.',
    );
    setName('');
    choose(id, next.regions);
  };
  const world = worlds.find((w) => w.map.id === chosen);
  const map = lib.regions.find((r) => r.id === chosen);
  const realm = realms.find((r) => `realm:${r.id}` === chosen);
  const wrong = map ? problems(map) : [];
  return (
    <fieldset class="world-pick">
      <legend>World</legend>
      <label>
        Play on{' '}
        <select value={chosen} onChange={(e) => choose((e.target as HTMLSelectElement).value)}>
          <option value="">The campaign</option>
          {realms.map((r) => (
            <option key={r.id} value={`realm:${r.id}`}>
              {r.name}
            </option>
          ))}
          {worlds.map((w) => (
            <option key={w.map.id} value={w.map.id}>
              {w.map.name}
            </option>
          ))}
          {lib.regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {problems(r).length > 0 ? ' (needs fixing)' : ''}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        New world{' '}
        <input
          placeholder="New lands"
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
        />
      </label>{' '}
      <button type="button" onClick={create}>
        Create a new world
      </button>
      {realm && (
        <p class="hint">
          {realm.text} {realm.regions.length} maps, no campaign story: no quests, factions, or
          raids.
        </p>
      )}
      {world && <p class="hint">{world.description}</p>}
      {map && (
        <p class="hint">
          {map.sites.length} towns, no campaign story: no quests, factions, or raids. Edit it in the{' '}
          <a href="#/maps">map editor</a>.
        </p>
      )}
      {wrong.length > 0 && (
        <p class="error" role="alert">
          This map can’t be played yet: {wrong[0]}
        </p>
      )}
      {note && (
        <p class="hint" role="status">
          {note}
        </p>
      )}
    </fieldset>
  );
}

/** Whether a chosen world can be started on. */
export const playableWorld = ({ map }: WorldChoice) =>
  map === null || worldMapErrors(data.srd, shippedContent, map).length === 0;
