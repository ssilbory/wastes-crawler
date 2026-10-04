import type { World } from '../../game/world/types.ts';
import { factionViews } from '../../render/faction-view.ts';
import { data } from '../builder/data.ts';

/** The Dark Lands' factions as the party hears of them (Phase 13). */
export function FactionsPanel(props: { world: World }) {
  const views = factionViews(props.world, data);
  if (views.length === 0) return null;
  return (
    <section class="panel" aria-label="Factions">
      <h3>Factions</h3>
      {views.map((v) => (
        <details key={v.id} class="faction">
          <summary>
            <strong>{v.name}</strong>: {v.standing}
          </summary>
          <p class="hint">{v.text}</p>
          {v.goal && <p>{v.goal}</p>}
          <ul class="setting-notes">
            {v.places.map((p) => (
              <li key={p.name}>
                {p.name}: {p.holdings.join(', ')}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
