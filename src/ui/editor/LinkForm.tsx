import type { Dungeon, Facing } from '../../data/schemas/index.ts';
import { linkAt, linkBothWays, setEntry, setLink } from '../../game/dungeon/dungeon-edit.ts';
import { walkMap } from '../../game/dungeon/sandbox.ts';
import type { Cell } from '../../rules/grid.ts';

const FACINGS: [Facing, string][] = [
  ['n', 'North'],
  ['e', 'East'],
  ['s', 'South'],
  ['w', 'West'],
];
const value = (e: Event) => (e.target as HTMLInputElement | HTMLSelectElement).value;

function FacingSelect(props: { label: string; value: Facing; onChange: (f: Facing) => void }) {
  return (
    <label class="field">
      <span>{props.label}</span>
      <select value={props.value} onChange={(e) => props.onChange(value(e) as Facing)}>
        {FACINGS.map(([f, name]) => (
          <option key={f} value={f}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Where the stairs on a cell lead: nowhere yet, up to the surface, or a cell of a level. */
export function LinkForm(props: {
  dungeon: Dungeon;
  level: string;
  cell: Cell;
  up: boolean;
  onChange: (d: Dungeon) => void;
  onLevel: (id: string) => void;
}) {
  const { dungeon: d, level, cell, onChange } = props;
  const link = linkAt(d, level, cell);
  const to = link?.to;
  const target = to && 'level' in to ? to : null;
  const where = !to ? '' : 'surface' in to ? 'surface' : to.level;
  const size = target ? walkMap(d, target.level) : null;
  const clamp = (n: number, max: number) => Math.min(Math.max(0, Math.floor(n) || 0), max - 1);
  const targetStairs = target ? linkAt(d, target.level, target.at) : undefined;
  const isStairs = (() => {
    if (!target || !size || !size.inBounds(target.at)) return false;
    const kind = size.cell(target.at);
    return kind === 'up' || kind === 'down';
  })();
  return (
    <fieldset>
      <legend>Stairs {props.up ? 'up' : 'down'}</legend>
      <label class="field">
        <span>Lead to</span>
        <select
          value={where}
          onChange={(e) => {
            const v = value(e);
            if (v === '') onChange(setLink(d, level, cell, null));
            else if (v === 'surface') onChange(setLink(d, level, cell, { surface: true }));
            else onChange(setLink(d, level, cell, { level: v, at: { x: 0, y: 0 }, facing: 'n' }));
          }}
        >
          <option value="">Nowhere yet</option>
          {props.up && <option value="surface">The surface</option>}
          {d.levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      {target && (
        <>
          <label class="field">
            <span>Column</span>
            <input
              type="number"
              min="0"
              max={(size?.width ?? 1) - 1}
              value={target.at.x}
              onChange={(e) =>
                onChange(
                  setLink(d, level, cell, {
                    ...target,
                    at: { ...target.at, x: clamp(Number(value(e)), size?.width ?? 1) },
                  }),
                )
              }
            />
          </label>
          <label class="field">
            <span>Row</span>
            <input
              type="number"
              min="0"
              max={(size?.height ?? 1) - 1}
              value={target.at.y}
              onChange={(e) =>
                onChange(
                  setLink(d, level, cell, {
                    ...target,
                    at: { ...target.at, y: clamp(Number(value(e)), size?.height ?? 1) },
                  }),
                )
              }
            />
          </label>
          <FacingSelect
            label="Arriving facing"
            value={target.facing}
            onChange={(facing) => onChange(setLink(d, level, cell, { ...target, facing }))}
          />
          <div class="field">
            <button type="button" onClick={() => props.onLevel(target.level)}>
              Go there
            </button>
          </div>
          {isStairs && (
            <p>
              {targetStairs &&
              'level' in targetStairs.to &&
              targetStairs.to.level === level &&
              targetStairs.to.at.x === cell.x &&
              targetStairs.to.at.y === cell.y ? (
                <span class="hint">The stairs there lead back here.</span>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      linkBothWays(
                        d,
                        { level, at: cell },
                        { level: target.level, at: target.at },
                        target.facing,
                      ),
                    )
                  }
                >
                  Link the stairs there back here
                </button>
              )}
            </p>
          )}
          {!isStairs && <p class="hint">Put stairs on that cell to come back this way.</p>}
        </>
      )}
    </fieldset>
  );
}

/** Making a cell the one the party stands on coming down from the surface. */
export function EntryForm(props: {
  dungeon: Dungeon;
  level: string;
  cell: Cell;
  onChange: (d: Dungeon) => void;
}) {
  const { dungeon: d, level, cell } = props;
  const here = d.entry.level === level && d.entry.at.x === cell.x && d.entry.at.y === cell.y;
  return here ? (
    <FacingSelect
      label="The party comes in here, facing"
      value={d.entry.facing}
      onChange={(f) => props.onChange(setEntry(d, level, cell, f))}
    />
  ) : (
    <p>
      <button
        type="button"
        onClick={() => props.onChange(setEntry(d, level, cell, d.entry.facing))}
      >
        The party comes in here
      </button>
    </p>
  );
}
