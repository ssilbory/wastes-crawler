import { useState } from 'preact/hooks';
import { beginWorking } from '../../game/world/workings.ts';
import type { World } from '../../game/world/types.ts';
import { workingsView } from '../../render/working-view.ts';
import { data } from '../builder/data.ts';

/**
 * Magical Workings (docs/rules-adaptation.md, Major projects: Workings): those the party could
 * begin where it stands, led by its best spellcaster with hired mages if it chooses, and those
 * under way or standing.
 */
export function WorkingsPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [hired, setHired] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const view = workingsView(w, data, hired);
  if (view.offers.length === 0 && view.standing.length === 0) return null;
  const begin = (id: string, lead: string, double: boolean) => {
    const r = beginWorking(w, data, id, lead, hired, double);
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <section class="panel" aria-label="Workings">
      <h3>Workings</h3>
      {view.standing.length > 0 && (
        <ul class="setting-notes">
          {view.standing.map((s, i) => (
            <li key={i}>
              {s.name}, {s.town}:{' '}
              {s.daysLeft === null
                ? 'stands'
                : `${s.lead}, ${s.daysLeft} days left${s.halted ? ` (halted: ${s.halted})` : ''}`}
            </li>
          ))}
        </ul>
      )}
      {view.offers.length > 0 && (
        <>
          <label>
            Hired mages ({view.hireFee} crowns each){' '}
            <select
              value={hired}
              onChange={(e) => setHired(Number((e.target as HTMLSelectElement).value))}
            >
              {Array.from({ length: view.hiredMost + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <ul class="project-list">
            {view.offers.map((o) => (
              <li key={o.id}>
                <details>
                  <summary>
                    <strong>{o.name}</strong>{' '}
                    <span class="slot-stats">
                      {o.degree}, {o.difficulty} points
                    </span>
                  </summary>
                  <p>{o.text}</p>
                  {o.lead && (
                    <p class="hint">
                      {o.lead.name} leads: {o.lead.points} points, and {o.lead.help} of help.
                    </p>
                  )}
                  {o.blocked ? (
                    <p class="hint">{o.blocked}</p>
                  ) : (
                    o.lead && (
                      <div class="actions" role="group" aria-label={`Begin ${o.name}`}>
                        <button
                          type="button"
                          onClick={() => begin(o.id, o.lead?.id as string, false)}
                        >
                          Begin ({o.cost} crowns, {o.days} days)
                        </button>
                        <button
                          type="button"
                          onClick={() => begin(o.id, o.lead?.id as string, true)}
                        >
                          At double cost ({o.doubleCost} crowns, {o.doubleDays} days)
                        </button>
                      </div>
                    )
                  )}
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
