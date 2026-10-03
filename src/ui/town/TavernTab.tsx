import type { RosterEntry } from '../../game/character/roster.ts';
import { MAX_PCS } from '../../game/world/new-world.ts';
import { bench, catchUpXp, inWorld, recruit, rejoin } from '../../game/world/tavern.ts';
import type { World } from '../../game/world/types.ts';
import { levelLine } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

/** Who travels with the party: up to six PCs, the rest waiting at any tavern. */
export function TavernTab(props: { world: World; roster: RosterEntry[]; act: Act }) {
  const w = props.world;
  const newcomers = props.roster.filter((e) => !inWorld(w, e.character.id));
  return (
    <>
      <section class="panel" aria-label="In the party">
        <h2>
          In the party ({w.members.length}/{MAX_PCS})
        </h2>
        <ul class="tavern-list">
          {w.members.map((m) => (
            <li key={m.id}>
              <span>
                <strong>{m.character.name}</strong> {levelLine(data, m.character)}
                {m.dead && ' · dead'}
              </span>
              <button type="button" onClick={() => props.act(() => bench(w, data, m.id))}>
                Leave at the tavern
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section class="panel" aria-label="At the tavern">
        <h2>At the tavern</h2>
        {w.benched.length === 0 && <p class="hint">No one is waiting here.</p>}
        <ul class="tavern-list">
          {w.benched.map((m) => (
            <li key={m.id}>
              <span>
                <strong>{m.character.name}</strong> {levelLine(data, m.character)}
                {m.dead && ' · dead'}
              </span>
              <button type="button" onClick={() => props.act(() => rejoin(w, data, m.id))}>
                Rejoin
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section class="panel" aria-label="New faces">
        <h2>New faces</h2>
        <p class="hint">
          Roster characters new to this world join with {catchUpXp(w)} XP, the lowest in the world,
          and add their crowns to the purse.
        </p>
        {newcomers.length === 0 && <p class="hint">Everyone in the roster is already here.</p>}
        <ul class="tavern-list">
          {newcomers.map((e) => (
            <li key={e.id}>
              <span>
                <strong>{e.character.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => props.act(() => recruit(w, data, e.character, e.defaultAction))}
              >
                Recruit
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
