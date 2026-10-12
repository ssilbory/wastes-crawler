import { useState } from 'preact/hooks';
import type { Dungeon, EditorLibrary, Region, TownSize } from '../../data/schemas/index.ts';
import { deleteRegion, saveDungeon, saveRegion, withLibrary } from '../../game/editor/library.ts';
import {
  mapErrors,
  paintDanger,
  paintTerrain,
  placeDungeon,
  placeSite,
  renameRegion,
} from '../../game/editor/map-edit.ts';
import { regionMapOf } from '../../game/world/region.ts';
import { mapPixels } from '../../render/hex-view.ts';
import { editorHexCells } from '../../render/map-editor-view.ts';
import type { Hex } from '../../rules/hex.ts';
import { data, freshRng, shippedContent } from '../builder/data.ts';
import { download, loadLibrary, saveLibrary } from '../editor-store.ts';
import { HexMap, HEX_SIZE } from '../world/HexMap.tsx';
import '../editor/editor.css';
import '../world/hex-map.css';
import '../world/world.css';
import { GeneratePanel } from './GeneratePanel.tsx';
import { HexPanel } from './HexPanel.tsx';
import './map-editor.css';

export type MapTool =
  { select: true } | { terrain: string } | { danger: string } | { site: TownSize };

const DANGERS: [string, string][] = [
  ['=', 'Road'],
  ['.', 'Ordinary'],
  ['!', 'Dangerous'],
];
const SITES: TownSize[] = ['village', 'town', 'city'];
const MAX_SHOWN = 8;
const cap = (s: string) => `${s[0]?.toUpperCase() ?? ''}${s.slice(1)}`;

/**
 * The overland map editor (Sam's calls): pick a map or roll a random one with settlements, paint
 * terrain and danger, place settlements and dungeons, and save it all in the browser.
 */
export function MapEditorApp() {
  const [loaded] = useState(loadLibrary);
  const [lib, setLib] = useState<EditorLibrary>(loaded.library);
  const [message, setMessage] = useState<string | null>(loaded.errors.join('; ') || null);
  const content = withLibrary(shippedContent, lib);
  const [region, setRegion] = useState<Region>(content.regions[0] as Region);
  /** Dungeons placed on this map since it was last saved. */
  const [placed, setPlaced] = useState<Dungeon[]>([]);
  const [tool, setTool] = useState<MapTool>({ select: true });
  const [selected, setSelected] = useState<Hex | null>(null);

  const saved = content.regions.find((r) => r.id === region.id);
  const unsaved = JSON.stringify(saved) !== JSON.stringify(region) || placed.length > 0;
  const dungeons = [
    ...content.dungeons.filter((d) => !placed.some((p) => p.id === d.id)),
    ...placed,
  ];
  const here = dungeons.filter((d) => d.region === region.id);
  const map = regionMapOf(content.terrains, region);
  const errors = mapErrors(data.srd, content, region, here);
  const cells = editorHexCells(
    map,
    here.map((d) => ({ ...d.entrance, name: d.name })),
    selected,
    HEX_SIZE,
  );
  const px = mapPixels(map, HEX_SIZE);

  const store = (next: EditorLibrary, done: string) => {
    setLib(next);
    setMessage(saveLibrary(next) ? done : 'Browser storage is unavailable; nothing was saved.');
  };
  const open = (r: Region) => {
    setRegion(r);
    setPlaced([]);
    setSelected(null);
  };
  const place = (d: Dungeon, h: Hex) =>
    setPlaced([...placed.filter((p) => p.id !== d.id), placeDungeon(d, region, h)]);
  const apply = (h: Hex, painting: boolean) => {
    if ('terrain' in tool) setRegion((r) => paintTerrain(r, h, tool.terrain));
    else if ('danger' in tool) setRegion((r) => paintDanger(r, h, tool.danger));
    else if (painting) return;
    else if ('site' in tool) setRegion(placeSite(data.content, freshRng(), region, h, tool.site));
    setSelected(h);
  };
  const save = () => {
    let next = saveRegion(lib, region);
    for (const d of placed) next = saveDungeon(next, d);
    store(next, `Saved ${region.name}${placed.length ? ' and the dungeons on it' : ''}.`);
    setPlaced([]);
  };
  const isSaved = lib.regions.some((r) => r.id === region.id);
  const shipped = shippedContent.regions.some((r) => r.id === region.id);
  const stranded = lib.dungeons.filter((d) => d.region === region.id);
  const tools: [string, MapTool][] = [
    ['Select', { select: true }],
    ...content.terrains.map((t): [string, MapTool] => [t.name, { terrain: t.glyph }]),
    ...DANGERS.map(([g, name]): [string, MapTool] => [name, { danger: g }]),
    ...SITES.map((s): [string, MapTool] => [cap(s), { site: s }]),
  ];
  const listed = content.regions.some((r) => r.id === region.id)
    ? content.regions
    : [...content.regions, region];

  return (
    <main class="editor map-editor">
      <h1>Map editor</h1>
      <div class="editor-bar">
        <label>
          Map{' '}
          <select
            value={region.id}
            onChange={(e) => {
              const r = listed.find((x) => x.id === (e.target as HTMLSelectElement).value);
              if (r) open(r);
            }}
          >
            {listed.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {lib.regions.some((s) => s.id === r.id) ? ' (saved)' : ''}
                {saved === undefined && r.id === region.id ? ' (not saved)' : ''}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Name{' '}
          <input
            value={region.name}
            onChange={(e) => setRegion(renameRegion(region, (e.target as HTMLInputElement).value))}
          />
        </label>{' '}
        <button type="button" class={unsaved ? 'primary' : undefined} onClick={save}>
          {unsaved ? 'Save map*' : 'Save map'}
        </button>{' '}
        {saved && (
          <button type="button" disabled={!unsaved} onClick={() => open(saved)}>
            Revert
          </button>
        )}{' '}
        {isSaved && (
          <button
            type="button"
            disabled={stranded.length > 0}
            title={stranded.length > 0 ? 'Move its saved dungeons to another map first' : undefined}
            onClick={() => {
              const next = deleteRegion(lib, region.id);
              store(
                next,
                shipped ? `Back to the shipped ${region.name}.` : `Deleted ${region.name}.`,
              );
              open(
                withLibrary(shippedContent, next).regions.find((r) => r.id === region.id) ??
                  (shippedContent.regions[0] as Region),
              );
            }}
          >
            {shipped ? 'Discard saved copy' : 'Delete map'}
          </button>
        )}{' '}
        <button
          type="button"
          onClick={() =>
            download(
              'regions.json',
              `${JSON.stringify(
                listed.map((r) => (r.id === region.id ? region : r)),
                null,
                2,
              )}\n`,
            )
          }
        >
          Download regions.json
        </button>
        {message && (
          <span class="hint" role="status">
            {message}
          </span>
        )}
      </div>
      <div class="tabs" role="radiogroup" aria-label="Tool">
        {tools.map(([name, t]) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={JSON.stringify(t) === JSON.stringify(tool)}
            onClick={() => setTool(t)}
          >
            {name}
          </button>
        ))}
      </div>
      <div class="editor-main">
        <div class="map-scroll">
          <HexMap
            cells={cells}
            width={px.width}
            height={px.height}
            label={`Editing ${region.name}`}
            onPick={(col, row) => apply({ col, row }, false)}
            onDrag={(col, row) => apply({ col, row }, true)}
          />
        </div>
        <div class="editor-side">
          <section class="panel" aria-label="Problems">
            <h2>Problems</h2>
            {errors.length === 0 ? (
              <p>The map is valid.</p>
            ) : (
              <ul class="errors">
                {errors.slice(0, MAX_SHOWN).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </section>
          {selected && (
            <HexPanel
              region={region}
              hex={selected}
              content={content}
              dungeons={dungeons}
              onChange={setRegion}
              onPlace={(d) => place(d, selected)}
            />
          )}
          <GeneratePanel
            taken={listed.map((r) => r.id)}
            onRegion={(r) => {
              open(r);
              setMessage(`Made ${r.name}. Save it to keep it.`);
            }}
          />
        </div>
      </div>
    </main>
  );
}
