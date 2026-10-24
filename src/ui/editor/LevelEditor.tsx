import { useState } from 'preact/hooks';
import type { CellKind, EdgeKind } from '../../data/dungeon-map.ts';
import type { ContentData, Dungeon } from '../../data/schemas/index.ts';
import { paintCell } from '../../game/dungeon/level-details.ts';
import { blankMap, editorErrors, setEdge, withLevelMap } from '../../game/dungeon/level-edit.ts';
import type { Walk } from '../../game/dungeon/sandbox.ts';
import type { Cell } from '../../rules/grid.ts';
import { editorGrid } from '../../render/level-editor-view.ts';
import { data } from '../builder/data.ts';
import { CellPanel } from './CellPanel.tsx';
import { DungeonPanel } from './DungeonPanel.tsx';
import type { Saving } from './EditorApp.tsx';
import { ExportPanel } from './ExportPanel.tsx';
import { LevelGrid } from './LevelGrid.tsx';
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

/** Problems listed at once; one cut-off room can make dozens. */
const MAX_SHOWN = 8;

/** One dungeon's levels being edited; choosing another dungeon starts afresh. */
export function LevelEditor(props: {
  original: Dungeon;
  /** The content with saved work in place, to check against. */
  content: ContentData;
  saving: Saving;
  newId: (name: string) => string;
}) {
  const { original } = props;
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
  const errors = editorErrors(props.content, edited, data.srd);
  const update = (next: string[]) => setEdited(withLevelMap(edited, level.id, next));
  const picked = selected?.level === level.id ? selected.cell : null;
  const current = (TOOLS[tool] as [string, Tool])[1];
  const walkingHere = walk?.level === level.id ? walk : null;
  const unsaved = JSON.stringify(edited) !== JSON.stringify(original);

  return (
    <>
      <div class="editor-bar">
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
            max="60"
            value={size.w}
            onInput={(e) => setSize({ ...size, w: Number((e.target as HTMLInputElement).value) })}
          />
        </label>{' '}
        <label>
          Height{' '}
          <input
            type="number"
            min="1"
            max="60"
            value={size.h}
            onInput={(e) => setSize({ ...size, h: Number((e.target as HTMLInputElement).value) })}
          />
        </label>{' '}
        <button type="button" onClick={() => update(blankMap(size.w, size.h))}>
          New blank map
        </button>{' '}
        <button
          type="button"
          class={unsaved ? 'primary' : undefined}
          onClick={() => props.saving.save(edited)}
        >
          {unsaved ? 'Save dungeon*' : 'Save dungeon'}
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
          <LevelGrid
            grid={grid}
            level={level}
            picked={picked}
            entry={edited.entry.level === level.id ? edited.entry.at : null}
            walker={walkingHere?.at ?? null}
            onCell={(cell) => {
              if ('cell' in current)
                setEdited(paintCell(data.content, edited, level.id, cell, current.cell));
              if (!('edge' in current)) setSelected({ level: level.id, cell });
            }}
            onEdge={(e) => {
              if ('edge' in current && !e.border) update(setEdge(rows, e, e.side, current.edge));
            }}
          />
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
          <DungeonPanel
            dungeon={edited}
            level={level.id}
            content={props.content}
            saving={props.saving}
            newId={props.newId}
            onChange={setEdited}
            onLevel={setLevelId}
          />
          <WalkPanel
            dungeon={edited}
            level={level.id}
            ready={grid !== null}
            walk={walk}
            onWalk={setWalk}
            onLevel={setLevelId}
          />
          <ExportPanel dungeon={edited} content={props.content} rows={rows} />
        </div>
        <div class="editor-side">
          {picked && (
            <CellPanel
              dungeon={edited}
              level={level.id}
              cell={picked}
              onChange={setEdited}
              onLevel={setLevelId}
            />
          )}
        </div>
      </div>
    </>
  );
}
