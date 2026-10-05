import { useState } from 'preact/hooks';
import type { CellKind, EdgeKind } from '../../data/dungeon-map.ts';
import type { Dungeon } from '../../data/schemas/index.ts';
import { paintCell } from '../../game/dungeon/level-details.ts';
import {
  blankMap,
  editorErrors,
  exportDungeons,
  setEdge,
  withLevelMap,
} from '../../game/dungeon/level-edit.ts';
import type { Cell } from '../../rules/grid.ts';
import type { Walk } from '../../game/dungeon/sandbox.ts';
import { EDIT_CELL, editorGrid } from '../../render/level-editor-view.ts';
import { data } from '../builder/data.ts';
import '../world/world.css';
import './editor.css';
import { CellPanel } from './CellPanel.tsx';
import { WalkPanel } from './WalkPanel.tsx';

type Tool = { cell: CellKind } | { edge: EdgeKind } | { select: true };
const TOOLS: [string, Tool][] = [
  ['Select', { select: true }],
  ['Wall', { edge: 'wall' }],
  ['Open', { edge: 'open' }],
  ['Door', { edge: 'door' }],
  ['Secret door', { edge: 'secret' }],
  ['Floor', { cell: 'floor' }],
  ['Stairs up', { cell: 'up' }],
  ['Stairs down', { cell: 'down' }],
  ['Trap', { cell: 'trap' }],
  ['NPC', { cell: 'npc' }],
];

function download(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dungeons.json';
  a.click();
  URL.revokeObjectURL(url);
}

const dungeons = data.content.dungeons;
/** Problems listed at once; one cut-off room can make dozens. */
const MAX_SHOWN = 8;

/** The level editor (docs/decisions/0003-level-authoring.md): edit, validate, walk, export. */
export function EditorApp() {
  const [dungeonId, setDungeonId] = useState(dungeons[0]?.id ?? '');
  const original = dungeons.find((d) => d.id === dungeonId);
  if (!original) return <p class="hint">There are no dungeons to edit.</p>;
  return <LevelEditor key={original.id} original={original} onDungeon={setDungeonId} />;
}

/** One dungeon's levels being edited; choosing another dungeon starts afresh. */
function LevelEditor(props: { original: Dungeon; onDungeon: (id: string) => void }) {
  const { original } = props;
  const dungeonId = original.id;
  const [levelId, setLevelId] = useState(original.levels[0]?.id ?? '');
  const [edited, setEdited] = useState<Dungeon>(original);
  // Painting walls is the usual first job, as it was before the Select tool came first.
  const [tool, setTool] = useState(TOOLS.findIndex(([name]) => name === 'Wall'));
  const [walk, setWalk] = useState<Walk | null>(null);
  const [size, setSize] = useState({ w: 8, h: 8 });
  /** The cell whose details are shown, on the level it was picked on. */
  const [selected, setSelected] = useState<{ level: string; cell: Cell } | null>(null);
  const level =
    edited.levels.find((l) => l.id === levelId) ??
    (edited.levels[0] as (typeof original.levels)[0]);
  const rows = level.map;
  const grid = editorGrid(rows);
  const errors = editorErrors(data.content, edited, data.srd);
  const update = (next: string[]) => setEdited(withLevelMap(edited, level.id, next));
  const picked = selected?.level === level.id ? selected.cell : null;
  const posts = new Set(level.garrisons.map((g) => `${g.at.x},${g.at.y}`));
  const safe = new Set(level.safe.map((c) => `${c.x},${c.y}`));
  const current = (TOOLS[tool] as [string, Tool])[1];
  const walkingHere = walk?.level === level.id ? walk : null;

  return (
    <main class="editor">
      <h1>Level editor</h1>
      <div class="editor-bar">
        <label>
          Dungeon{' '}
          <select
            value={dungeonId}
            onChange={(e) => {
              props.onDungeon((e.target as HTMLSelectElement).value);
            }}
          >
            {dungeons.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Level{' '}
          <select
            value={level.id}
            onChange={(e) => setLevelId((e.target as HTMLSelectElement).value)}
          >
            {edited.levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <button
          type="button"
          onClick={() =>
            setEdited({
              ...edited,
              levels: edited.levels.map(
                (l) => original.levels.find((o) => o.id === l.id && l.id === level.id) ?? l,
              ),
            })
          }
        >
          Revert level
        </button>{' '}
        <label>
          Width{' '}
          <input
            type="number"
            min="1"
            max="30"
            value={size.w}
            onInput={(e) => setSize({ ...size, w: Number((e.target as HTMLInputElement).value) })}
          />
        </label>{' '}
        <label>
          Height{' '}
          <input
            type="number"
            min="1"
            max="30"
            value={size.h}
            onInput={(e) => setSize({ ...size, h: Number((e.target as HTMLInputElement).value) })}
          />
        </label>{' '}
        <button type="button" onClick={() => update(blankMap(size.w, size.h))}>
          New blank map
        </button>
      </div>
      <div class="tabs" role="radiogroup" aria-label="Tool">
        {TOOLS.map(([name], i) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={tool === i}
            onClick={() => setTool(i)}
          >
            {name}
          </button>
        ))}
      </div>
      <div class="editor-main">
        {grid && (
          <svg
            class="editor-grid"
            viewBox={`-4 -4 ${grid.width + 8} ${grid.height + 8}`}
            width={(grid.width + 8) * 1.5}
            role="img"
            aria-label={`Editing ${level.name}`}
          >
            {grid.cells.map((c) => (
              <rect
                key={`${c.x},${c.y}`}
                class={`cell ${c.kind}${safe.has(`${c.x},${c.y}`) ? ' safe' : ''}${
                  picked?.x === c.x && picked.y === c.y ? ' picked' : ''
                }`}
                data-cell={`${c.x},${c.y}`}
                x={c.x * EDIT_CELL}
                y={c.y * EDIT_CELL}
                width={EDIT_CELL}
                height={EDIT_CELL}
                onClick={() => {
                  const cell = { x: c.x, y: c.y };
                  if ('cell' in current)
                    setEdited(paintCell(data.content, edited, level.id, cell, current.cell));
                  if (!('edge' in current)) setSelected({ level: level.id, cell });
                }}
              />
            ))}
            {grid.cells.map((c) =>
              c.kind === 'floor' && !posts.has(`${c.x},${c.y}`) ? null : (
                <text
                  key={`t-${c.x},${c.y}`}
                  class="glyph"
                  x={(c.x + 0.5) * EDIT_CELL}
                  y={(c.y + 0.68) * EDIT_CELL}
                >
                  {{ floor: 'G', up: '<', down: '>', trap: 'T', npc: 'N' }[c.kind]}
                </text>
              ),
            )}
            {grid.edges.map((e) => (
              <line
                key={e.key}
                class={`edge ${e.kind}${e.border ? ' border' : ''}`}
                data-edge={e.key}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                onClick={() => {
                  if ('edge' in current && !e.border)
                    update(setEdge(rows, e, e.side, current.edge));
                }}
              />
            ))}
            {walkingHere && (
              <circle
                class="walker"
                cx={(walkingHere.at.x + 0.5) * EDIT_CELL}
                cy={(walkingHere.at.y + 0.5) * EDIT_CELL}
                r={EDIT_CELL / 4}
              />
            )}
          </svg>
        )}
        <div class="editor-side">
          <section class="panel" aria-label="Problems">
            <h2>Problems</h2>
            {errors.length === 0 ? (
              <p>The dungeon is valid.</p>
            ) : (
              <>
                <ul class="errors">
                  {errors.slice(0, MAX_SHOWN).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                {errors.length > MAX_SHOWN && (
                  <p class="hint">and {errors.length - MAX_SHOWN} more.</p>
                )}
              </>
            )}
          </section>
          {picked && (
            <CellPanel dungeon={edited} level={level.id} cell={picked} onChange={setEdited} />
          )}
          <WalkPanel
            dungeon={edited}
            level={level.id}
            ready={grid !== null}
            walk={walk}
            onWalk={setWalk}
            onLevel={setLevelId}
          />
          <section class="panel" aria-label="Export">
            <h2>Export</h2>
            <p class="hint">Save over data/content/dungeons.json, then run pnpm validate:levels.</p>
            <button type="button" onClick={() => download(exportDungeons(data.content, edited))}>
              Download dungeons.json
            </button>
            <textarea readOnly rows={rows.length} aria-label="Map text" value={rows.join('\n')} />
          </section>
        </div>
      </div>
    </main>
  );
}
