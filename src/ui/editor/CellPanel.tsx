import type { Dungeon } from '../../data/schemas/index.ts';
import {
  cellDetails,
  setCaptive,
  setGarrison,
  setNpcKind,
  setSafe,
  setTrap,
} from '../../game/dungeon/level-details.ts';
import type { Cell } from '../../rules/grid.ts';
import { MonsterPicker } from '../arena/MonsterPicker.tsx';
import { data } from '../builder/data.ts';
import { walkMap } from '../../game/dungeon/sandbox.ts';
import { EntryForm, LinkForm } from './LinkForm.tsx';
import { TrapForm } from './TrapForm.tsx';

/**
 * The selected cell's details: safe camping, a trap's details, a captive or guard post, where its
 * stairs lead, and whether the party comes in here.
 */
export function CellPanel(props: {
  dungeon: Dungeon;
  level: string;
  cell: Cell;
  onChange: (d: Dungeon) => void;
  onLevel: (id: string) => void;
}) {
  const { dungeon: d, level, cell } = props;
  const details = cellDetails(d, level, cell);
  const map = walkMap(d, level);
  const kind = map?.inBounds(cell) ? map.cell(cell) : null;
  const { trap, captive, garrison } = details;
  return (
    <section class="panel cell-panel" aria-label="Cell details">
      <h2>
        Cell {cell.x},{cell.y}
      </h2>
      <label class="check">
        <input
          type="checkbox"
          checked={details.safe}
          onChange={(e) =>
            props.onChange(setSafe(d, level, cell, (e.target as HTMLInputElement).checked))
          }
        />{' '}
        Safe to camp
      </label>
      <EntryForm dungeon={d} level={level} cell={cell} onChange={props.onChange} />
      {(kind === 'up' || kind === 'down') && (
        <LinkForm
          dungeon={d}
          level={level}
          cell={cell}
          up={kind === 'up'}
          onChange={props.onChange}
          onLevel={props.onLevel}
        />
      )}
      {trap && <TrapForm trap={trap} onChange={(t) => props.onChange(setTrap(d, level, t))} />}
      {(captive || garrison) && (
        <fieldset>
          <legend>NPC</legend>
          <label class="field">
            <span>Kind</span>
            <select
              value={captive ? 'captive' : 'guard'}
              onChange={(e) =>
                props.onChange(
                  setNpcKind(
                    data.content,
                    d,
                    level,
                    cell,
                    (e.target as HTMLSelectElement).value as 'captive' | 'guard',
                  ),
                )
              }
            >
              <option value="captive">Captive, held by guards</option>
              <option value="guard">Guard post</option>
            </select>
          </label>
          {captive && (
            <>
              <label class="field">
                <span>Captive</span>
                <select
                  value={captive.captive}
                  onChange={(e) =>
                    props.onChange(
                      setCaptive(d, level, {
                        ...captive,
                        captive: (e.target as HTMLSelectElement).value,
                      }),
                    )
                  }
                >
                  {data.content.captives.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <MonsterPicker
                title="Guards"
                rows={captive.guards}
                onChange={(update) =>
                  props.onChange(
                    setCaptive(d, level, { ...captive, guards: update(captive.guards) }),
                  )
                }
              />
              <TextField
                label="What the party sees"
                value={captive.text}
                onChange={(text) => props.onChange(setCaptive(d, level, { ...captive, text }))}
              />
            </>
          )}
          {garrison && (
            <>
              <label class="field">
                <span>Standing order</span>
                <select
                  value={garrison.order}
                  onChange={(e) =>
                    props.onChange(
                      setGarrison(d, level, {
                        ...garrison,
                        order: (e.target as HTMLSelectElement).value,
                      }),
                    )
                  }
                >
                  {data.content.standingOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <MonsterPicker
                title="Guards at the post"
                rows={garrison.enemies}
                onChange={(update) =>
                  props.onChange(
                    setGarrison(d, level, { ...garrison, enemies: update(garrison.enemies) }),
                  )
                }
              />
              <TextField
                label="What the party sees"
                value={garrison.text}
                onChange={(text) => props.onChange(setGarrison(d, level, { ...garrison, text }))}
              />
            </>
          )}
        </fieldset>
      )}
      {!trap && !captive && !garrison && kind !== 'up' && kind !== 'down' && (
        <p class="hint">
          Paint a trap, an NPC, or stairs here for more details. To place a guard post, paint an NPC
          and make it a guard post.
        </p>
      )}
    </section>
  );
}

function TextField(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label class="field">
      <span>{props.label}</span>
      <textarea
        rows={2}
        value={props.value}
        onInput={(e) => {
          const v = (e.target as HTMLTextAreaElement).value;
          if (v.trim()) props.onChange(v);
        }}
        // An empty entry isn't kept; leaving the field shows the text that was.
        onBlur={(e) => {
          (e.target as HTMLTextAreaElement).value = props.value;
        }}
      />
    </label>
  );
}
