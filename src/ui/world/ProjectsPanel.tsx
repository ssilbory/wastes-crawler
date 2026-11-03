import { useState } from 'preact/hooks';
import { buyRenown, spendRenown } from '../../game/world/major-projects.ts';
import type { World } from '../../game/world/types.ts';
import { projectsView } from '../../render/project-view.ts';
import { data } from '../builder/data.ts';

/**
 * Major projects on the party's map (docs/rules-adaptation.md, Major projects): the Renown to
 * spend, and each project's progress, opposition, and tied adventures. Renown and bought points go
 * in from any settlement on the project's map.
 */
export function ProjectsPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const view = projectsView(w, data);
  if (view.projects.length === 0) return null;
  const act = (r: { ok: true } | { ok: false; reason: string }) => {
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <section class="panel projects-panel" aria-label="Projects">
      <h3>Projects</h3>
      <p>
        <strong>Renown: {view.renown}</strong>
      </p>
      <ul class="project-list">
        {view.projects.map((p) => (
          <li key={p.id} class={p.done ? 'gone' : undefined}>
            <details>
              <summary>
                <strong>{p.name}</strong>{' '}
                <span class="slot-stats">
                  {p.done ? 'done' : `${p.renown} of ${p.difficulty} Renown`}
                </span>
              </summary>
              {p.done ? (
                <p>{p.ending}</p>
              ) : (
                <>
                  <p>{p.text}</p>
                  <p class="hint">
                    Worked from {p.place}.{' '}
                    {p.opposition ? `Against it: ${p.opposition}.` : 'No one stands against it.'}
                  </p>
                  {p.adventures.length > 0 && (
                    <ul class="setting-notes">
                      {p.adventures.map((a) => (
                        <li key={a.name} class={a.done ? 'gone' : undefined}>
                          {a.name}: {a.done ? 'done' : `takes ${a.percent}% off`}
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.build && <p class="hint">Also needs {p.build}.</p>}
                  {p.blocked ? (
                    <p class="hint">{p.blocked}</p>
                  ) : (
                    p.needed > 0 && (
                      <div class="actions" role="group" aria-label={`Work on ${p.name}`}>
                        <button
                          type="button"
                          disabled={view.renown === 0}
                          onClick={() => act(spendRenown(w, data, p.id, p.needed))}
                        >
                          Put in Renown ({Math.min(view.renown, p.needed)})
                        </button>
                        {p.pointPrice !== null && (
                          <button
                            type="button"
                            disabled={w.purse < p.pointPrice}
                            onClick={() => act(buyRenown(w, data, p.id, 1))}
                          >
                            Buy 1 Renown ({p.pointPrice} crowns)
                          </button>
                        )}
                      </div>
                    )
                  )}
                </>
              )}
            </details>
          </li>
        ))}
      </ul>
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
