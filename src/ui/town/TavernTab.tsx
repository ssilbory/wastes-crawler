import type { RosterEntry } from '../../game/character/roster.ts';
import { MAX_PCS } from '../../game/world/new-world.ts';
import { hire } from '../../game/world/hire.ts';
import { MAX_NPCS } from '../../game/world/npcs.ts';
import { hireBlocked, payDeadShare, refuseDeadShare } from '../../game/world/shares.ts';
import { shareText } from '../../game/world/wording.ts';
import { buyRumor, rumorListed, rumorsLeft } from '../../game/world/rumors.ts';
import { bench, catchUpXp, inWorld, recruit, rejoin } from '../../game/world/tavern.ts';
import { priceHere } from '../../game/world/town.ts';
import type { World } from '../../game/world/types.ts';
import { levelLine } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

/** Who travels with the party: up to six PCs, the rest waiting at any tavern. */
export function TavernTab(props: { world: World; roster: RosterEntry[]; act: Act }) {
  const w = props.world;
  const blocked = hireBlocked(w, data);
  const newcomers = props.roster.filter((e) => !inWorld(w, e.character.id));
  const rumors = rumorsLeft(w, data).length;
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
      <section class="panel" aria-label="Hirelings">
        <h2>
          Hirelings ({w.npcs.length}/{MAX_NPCS} NPC slots)
        </h2>
        <p class="hint">
          {data.content.npcRules.signingFee} crowns to sign on (
          {data.content.npcRules.signingRefund} back if let go alive in a settlement), then a share
          of the loot won while they travel with the party, paid in the next town. A hireling the
          party can't pay leaves, and any may quit after a dangerous fight.
        </p>
        {w.deadShares.map((d, i) => (
          <div key={d.name} class="parley" role="group" aria-label={`${d.name}'s share`}>
            <p>
              {d.name} died owed {d.owed} crowns. Their kin are waiting. Refusing means no one here
              will sign on for a month.
            </p>
            <button type="button" onClick={() => props.act(() => payDeadShare(w, data, i))}>
              Pay {d.name}'s share
            </button>
            <button type="button" onClick={() => props.act(() => refuseDeadShare(w, data, i))}>
              Refuse
            </button>
          </div>
        ))}
        {blocked && <p class="hint">{blocked}</p>}
        <ul class="tavern-list">
          {data.content.npcRules.hirelings.map((h) => (
            <li key={h.id}>
              <span>
                <strong>{h.name}</strong> {shareText(h.share)}
                {h.role === 'fighter' ? '' : ` · ${h.role}, stays out of fights`}
              </span>
              <button type="button" onClick={() => props.act(() => hire(w, data, h.id))}>
                Hire a {h.name}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section class="panel" aria-label="Rumors">
        <h2>Rumors</h2>
        <p class="hint">
          Buy the common room a round, and someone will tell of a way down nearby that no one is
          paying to have cleared. The map shows it from then on.
        </p>
        {rumors === 0 ? (
          <p class="hint">The regulars know of no other ways down around here.</p>
        ) : (
          <button type="button" onClick={() => props.act(() => buyRumor(w, data))}>
            Buy a round for a rumor ({priceHere(w, data, rumorListed(data))} crowns)
          </button>
        )}
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
