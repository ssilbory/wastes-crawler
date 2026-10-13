import type { DungeonLevel, Furniture } from '../../data/schemas/index.ts';
import type { Cell } from '../../rules/grid.ts';
import { EDIT_CELL, type EditorGrid, type GridEdge } from '../../render/level-editor-view.ts';

/** Short marks for furniture in a cell's corner. */
const FURNITURE_MARKS: Record<Furniture['kind'], string> = {
  rubble: 'ru',
  bones: 'bo',
  altar: 'al',
  fountain: 'fo',
  brazier: 'br',
};

/** The level being edited as SVG: cells and edges to click, glyphs, and the test walker. */
export function LevelGrid(props: {
  grid: EditorGrid;
  level: DungeonLevel;
  picked: Cell | null;
  entry: Cell | null;
  walker: Cell | null;
  onCell: (c: Cell) => void;
  onEdge: (e: GridEdge) => void;
}) {
  const { grid, level, picked, entry, walker } = props;
  const posts = new Set(level.garrisons.map((g) => `${g.at.x},${g.at.y}`));
  const safe = new Set(level.safe.map((c) => `${c.x},${c.y}`));
  const linked = new Set(level.links.map((k) => `${k.at.x},${k.at.y}`));
  return (
    <svg
      class="editor-grid"
      viewBox={`-4 -4 ${grid.width + 8} ${grid.height + 8}`}
      width={(grid.width + 8) * 1.5}
      role="img"
      aria-label={`Editing ${level.name}`}
    >
      {grid.cells.map((c) => {
        const key = `${c.x},${c.y}`;
        const stairs = c.kind === 'up' || c.kind === 'down';
        return (
          <rect
            key={key}
            class={`cell ${c.kind}${safe.has(key) ? ' safe' : ''}${
              picked?.x === c.x && picked.y === c.y ? ' picked' : ''
            }${stairs && !linked.has(key) ? ' unlinked' : ''}`}
            data-cell={key}
            x={c.x * EDIT_CELL}
            y={c.y * EDIT_CELL}
            width={EDIT_CELL}
            height={EDIT_CELL}
            onClick={() => props.onCell({ x: c.x, y: c.y })}
          />
        );
      })}
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
          onClick={() => props.onEdge(e)}
        />
      ))}
      {(level.furniture ?? []).map((f) => (
        <text
          key={`f-${f.at.x},${f.at.y}`}
          class="furniture-mark"
          x={(f.at.x + 0.08) * EDIT_CELL}
          y={(f.at.y + 0.32) * EDIT_CELL}
        >
          {FURNITURE_MARKS[f.kind]}
          <title>{f.kind}</title>
        </text>
      ))}
      {entry && (
        <circle
          class="entry"
          cx={(entry.x + 0.5) * EDIT_CELL}
          cy={(entry.y + 0.5) * EDIT_CELL}
          r={EDIT_CELL / 3}
        >
          <title>Where the party comes in</title>
        </circle>
      )}
      {walker && (
        <circle
          class="walker"
          cx={(walker.x + 0.5) * EDIT_CELL}
          cy={(walker.y + 0.5) * EDIT_CELL}
          r={EDIT_CELL / 4}
        />
      )}
    </svg>
  );
}
