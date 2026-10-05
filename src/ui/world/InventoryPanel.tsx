import { useState } from 'preact/hooks';
import type { ItemLocation } from '../../data/schemas/index.ts';
import { dropGear, giveGear, moveGear } from '../../game/world/inventory.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { inventoryView, loadText, type GearLine } from '../../render/inventory-view.ts';
import { data } from '../builder/data.ts';

const PLACES: ItemLocation[] = ['worn', 'readied', 'stowed'];

/** A member's gear and load: move, split, give, and drop items (Phase 17). */
export function InventoryPanel(props: {
  world: World;
  onChange: () => void;
  /** Shows this member's gear only, without the picker. */
  memberId?: string;
}) {
  const w = props.world;
  const [picked, setWho] = useState(w.members[0]?.id ?? '');
  const who = props.memberId ?? picked;
  const [message, setMessage] = useState<string | null>(null);
  const view = inventoryView(w, data, who);
  if (!view) return null;
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <section class="panel inventory" aria-label="Inventory">
      <h3>Inventory</h3>
      {props.memberId === undefined && (
        <label class="field">
          <span>Carried by</span>
          <select value={who} onChange={(e) => setWho((e.target as HTMLSelectElement).value)}>
            {w.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.character.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p class={view.load.state === 'ok' ? 'hint' : 'bump'}>{loadText(view.load)}</p>
      {view.blocked && <p class="hint">{view.blocked}</p>}
      {view.costsTurn && !view.blocked && (
        <p class="hint">Underground, each change takes a turn.</p>
      )}
      {view.lines.length === 0 && <p class="hint">{view.name} carries nothing.</p>}
      <ul class="gear">
        {view.lines.map((line) => (
          <GearRow
            // Any change to the line starts its row afresh, so an armed Drop never lands on another.
            key={`${who}-${line.index}-${line.name}-${line.location}-${line.quantity}`}
            line={line}
            others={view.others}
            disabled={view.blocked !== null}
            onMove={(location, n) => run(() => moveGear(w, data, who, line.index, location, n))}
            onGive={(to, n) => run(() => giveGear(w, data, who, line.index, to, n))}
            onDrop={(n) => run(() => dropGear(w, data, who, line.index, n))}
          />
        ))}
      </ul>
      {message && <p class="bump">{message}</p>}
    </section>
  );
}

function GearRow(props: {
  line: GearLine;
  others: { id: string; name: string }[];
  disabled: boolean;
  onMove: (location: ItemLocation, quantity: number) => void;
  onGive: (to: string, quantity: number) => void;
  onDrop: (quantity: number) => void;
}) {
  const { line } = props;
  const [count, setCount] = useState(line.quantity);
  const [dropping, setDropping] = useState(false);
  const n = Math.min(Math.max(1, count), line.quantity);
  return (
    <li role="group" aria-label={line.name}>
      <span class="gear-name">
        {line.name}
        {line.quantity > 1 ? ` × ${line.quantity}` : ''} (enc {line.encumbrance})
      </span>
      {line.quantity > 1 && (
        <input
          type="number"
          min={1}
          max={line.quantity}
          value={count}
          aria-label={`How many ${line.name}`}
          onInput={(e) => setCount(Number((e.target as HTMLInputElement).value))}
        />
      )}
      <select
        aria-label={`Where ${line.name} is carried`}
        value={line.location}
        disabled={props.disabled}
        onChange={(e) => props.onMove((e.target as HTMLSelectElement).value as ItemLocation, n)}
      >
        {PLACES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      {props.others.length > 0 && (
        <select
          aria-label={`Give ${line.name} to`}
          value=""
          disabled={props.disabled}
          onChange={(e) => {
            const to = (e.target as HTMLSelectElement).value;
            if (to) props.onGive(to, n);
          }}
        >
          <option value="">Give to…</option>
          {props.others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}
      {dropping ? (
        <>
          <button
            type="button"
            onClick={() => {
              setDropping(false);
              props.onDrop(n);
            }}
          >
            Drop for good
          </button>
          <button type="button" onClick={() => setDropping(false)}>
            Keep
          </button>
        </>
      ) : (
        <button type="button" disabled={props.disabled} onClick={() => setDropping(true)}>
          Drop
        </button>
      )}
    </li>
  );
}
