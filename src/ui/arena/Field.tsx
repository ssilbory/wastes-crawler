import type { SideView, SlotView } from '../../render/arena-view.ts';

interface FieldProps {
  /** The far side, drawn on top with its front row nearest the middle. */
  far: SideView;
  /** The near side, drawn below with its front row on top. */
  near: SideView;
  /** Whose turn it is. */
  activeId?: string | null;
  /** Slots that can be picked as the current command's target. */
  targetIds?: ReadonlySet<string>;
  /** Slots changed by the last batch of turns. */
  changedIds?: ReadonlySet<string>;
  onPick?: (id: string) => void;
}

function Slot(props: {
  slot: SlotView | null;
  active: boolean;
  target: boolean;
  changed: boolean;
  onPick?: ((id: string) => void) | undefined;
}) {
  const { slot } = props;
  if (!slot) return <div class="slot empty" aria-hidden="true" />;
  const classes = [
    'slot',
    slot.gone ? 'gone' : '',
    slot.status === 'dying' || slot.status === 'stable' ? 'down' : '',
    props.active ? 'active' : '',
    props.target ? 'target' : '',
    props.changed ? 'changed' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const body = (
    <>
      <span class="slot-name">{slot.label}</span>
      <span class="hp-bar" aria-hidden="true">
        <span style={{ width: `${slot.hpPercent}%` }} />
      </span>
      <span class="slot-stats">
        HP {Math.max(0, slot.hp)}/{slot.maxHp} · AC {slot.ac}
      </span>
      {slot.conditions.length > 0 && (
        <span class="conditions">
          {slot.conditions.map((c) => (
            <span key={c} class="chip">
              {c}
            </span>
          ))}
        </span>
      )}
    </>
  );
  return props.target && props.onPick ? (
    <button
      type="button"
      class={classes}
      data-slot={slot.id}
      aria-label={`Target ${slot.label}`}
      onClick={() => props.onPick?.(slot.id)}
    >
      {body}
    </button>
  ) : (
    <div class={classes} data-slot={slot.id}>
      {body}
    </div>
  );
}

type SideProps = Omit<FieldProps, 'far' | 'near'> & { view: SideView; isFar: boolean };

function Side(props: SideProps) {
  const rows = props.view.rows.map((row, index) => ({ row, index }));
  const ordered = props.isFar ? [...rows].reverse() : rows;
  return (
    <section class={`side ${props.isFar ? 'far' : 'near'}`} aria-label={props.view.title}>
      <h3>{props.view.title}</h3>
      {ordered.map(({ row, index }) => (
        <div class="field-row" key={index}>
          <span class="row-name">{props.view.rowNames[index]}</span>
          <div
            class="slots"
            style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
          >
            {row.map((slot, column) => (
              <Slot
                key={slot?.id ?? `empty-${column}`}
                slot={slot}
                active={slot !== null && slot.id === props.activeId}
                target={slot !== null && (props.targetIds?.has(slot.id) ?? false)}
                changed={slot !== null && (props.changedIds?.has(slot.id) ?? false)}
                onPick={props.onPick}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function Field(props: FieldProps) {
  return (
    <div class="battlefield">
      <Side {...props} view={props.far} isFar={true} />
      <Side {...props} view={props.near} isFar={false} />
    </div>
  );
}

export function BattleLog(props: { lines: readonly string[]; from: number }) {
  return (
    <section class="log" aria-label="Battle log">
      <h3>Log</h3>
      <ol>
        {props.lines.map((line, i) => (
          <li key={i} class={i >= props.from ? 'new' : undefined}>
            {line}
          </li>
        ))}
      </ol>
    </section>
  );
}
