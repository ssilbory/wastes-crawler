import { boardCoach, fareListed, routesFrom } from '../../game/world/coach.ts';
import { priceHere, townHere } from '../../game/world/town.ts';
import type { World } from '../../game/world/types.ts';
import { crowns } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

/** Coaches out of town (docs/rules-adaptation.md, Coach routes). */
export function TravelTab(props: { world: World; act: Act; onBoard: () => void }) {
  const w = props.world;
  const routes = routesFrom(w, data, townHere(w, data).id);
  return (
    <section class="panel" aria-label="Coaches">
      <h2>Coaches</h2>
      <p class="hint">
        The coach keeps to the road, travels by day, and stops at waystations at night with meals
        and beds. Bandits and beasts sometimes waylay it.
      </p>
      {routes.length === 0 && <p class="hint">No coach runs from here.</p>}
      <ul class="tavern-list">
        {routes.map(({ route, to }) => (
          <li key={route.id}>
            <span>
              <strong>To {to.name}</strong> {crowns(route.fare)} a passenger
            </span>
            <button
              type="button"
              onClick={() =>
                props.act(() => {
                  const r = boardCoach(w, data, route.id);
                  if (r.ok) props.onBoard();
                  return r;
                })
              }
            >
              Board for {crowns(priceHere(w, data, fareListed(w, data, route.id)))}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
