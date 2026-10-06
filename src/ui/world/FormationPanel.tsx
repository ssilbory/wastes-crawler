import { moveToSlot } from '../../game/world/formation.ts';
import type { World } from '../../game/world/types.ts';
import { formationView } from '../../render/formation-view.ts';

/** Two rows of four slots; picking someone for a slot swaps them with whoever stands there. */
export function FormationPanel(props: { world: World; onChange: () => void }) {
  const view = formationView(props.world);
  return (
    <section class="panel" aria-label="Formation">
      <h3>Formation</h3>
      {view.rows.map((r) => (
        <div class="picker-row" key={r.name}>
          <span class="row-name">{r.name}</span>
          <div class="formation-slots">
            {r.slots.map((s) => (
              <select
                key={`${s.row}-${s.column}`}
                aria-label={`${r.name}, slot ${s.column + 1}`}
                value={s.id ?? ''}
                onChange={(e) => {
                  const id = (e.target as HTMLSelectElement).value;
                  if (id && moveToSlot(props.world, id, s.row, s.column)) props.onChange();
                }}
              >
                {s.id === null && <option value="">Empty</option>}
                {view.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
