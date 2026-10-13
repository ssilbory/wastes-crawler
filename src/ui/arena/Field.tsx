import type { SideView, SlotView } from '../../render/arena-view.ts';
import { flash, type Float } from '../../render/fight-fx.ts';

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
  /** Numbers to float up off each slot from the last batch, and that batch's key. */
  floats?: ReadonlyMap<string, Float[]>;
  batchKey?: number;
  /** A line under each target's name, such as the odds of the attack chosen. */
  notes?: ReadonlyMap<string, string>;
  onPick?: (id: string) => void;
  /** Only the near side: no foes to draw, as when tending a trap's fallen. */
  nearOnly?: boolean;
}

function Slot(props: {
  slot: SlotView | null;
  active: boolean;
  target: boolean;
  changed: boolean;
  floats: Float[] | undefined;
  batchKey: number;
  note: string | undefined;
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
  const hit = flash(props.floats);
  const body = (
    <>
      {hit && (
        // Keyed by the batch, so each batch plays its flash and numbers afresh.
        <span class={`fx ${hit}`} key={props.batchKey} aria-hidden="true">
          {props.floats?.map((f, i) => (
            <span key={i} class={`float ${f.kind}`} style={{ animationDelay: `${i * 0.25}s` }}>
              {f.text}
            </span>
          ))}
        </span>
      )}
      <span class="slot-name">{slot.label}</span>
      {props.note && <span class="odds">{props.note}</span>}
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
      aria-label={`Target ${slot.label}${props.note ? `, ${props.note}` : ''}`}
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
            {row.map((slot, column) => {
              const one = (s: SlotView | null, key: string) => (
                <Slot
                  key={key}
                  slot={s}
                  active={s !== null && s.id === props.activeId}
                  target={s !== null && (props.targetIds?.has(s.id) ?? false)}
                  changed={s !== null && (props.changedIds?.has(s.id) ?? false)}
                  floats={s ? props.floats?.get(s.id) : undefined}
                  batchKey={props.batchKey ?? 0}
                  note={s && props.targetIds?.has(s.id) ? props.notes?.get(s.id) : undefined}
                  onPick={props.onPick}
                />
              );
              const key = slot?.id ?? `empty-${column}`;
              // A war mount fights from its rider's slot, shown beneath them.
              return slot?.mount ? (
                <div class="slot-stack" key={key}>
                  {one(slot, slot.id)}
                  {one(slot.mount, slot.mount.id)}
                </div>
              ) : (
                one(slot, key)
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

export function Field(props: FieldProps) {
  return (
    <div class="battlefield">
      {!props.nearOnly && <Side {...props} view={props.far} isFar={true} />}
      <Side {...props} view={props.near} isFar={false} />
    </div>
  );
}

/** The fight so far, newest line first, so it reads from the top of its scrolling box. */
export function BattleLog(props: { lines: readonly string[]; from: number }) {
  return (
    <section class="log" aria-label="Battle log">
      <h3>Log</h3>
      <ol>
        {props.lines
          .map((line, i) => (
            <li key={i} class={i >= props.from ? 'new' : undefined}>
              {line}
            </li>
          ))
          .reverse()}
      </ol>
    </section>
  );
}
