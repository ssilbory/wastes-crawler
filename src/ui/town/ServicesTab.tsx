import {
  cureFrail,
  healListed,
  innListed,
  healerHeal,
  raiseDead,
  raiseListed,
  raiserHere,
  stayAtInn,
} from '../../game/world/services.ts';
import { exchangeLoot } from '../../game/world/shop.ts';
import { priceHere } from '../../game/world/town.ts';
import type { World } from '../../game/world/types.ts';
import { crowns, lootText } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

export function ServicesTab(props: { world: World; act: Act }) {
  const w = props.world;
  const price = (listed: number) => crowns(priceHere(w, data, listed));
  const rules = data.content.townRules;
  const raiser = raiserHere(w, data);
  const dead = w.members.filter((m) => m.dead);
  return (
    <>
      <section class="panel" aria-label="Inn">
        <h2>Inn</h2>
        <p class="hint">
          A night's rest heals, clears strain and Broken, and restocks the rations. The party wakes
          the next morning.
        </p>
        <button type="button" onClick={() => props.act(() => stayAtInn(w, data))}>
          Stay the night ({price(innListed(w, data))})
        </button>
      </section>
      <section class="panel" aria-label="Traders">
        <h2>Traders</h2>
        <p>Loot carried: {lootText(w.loot)}</p>
        <button
          type="button"
          disabled={w.loot.length === 0}
          onClick={() =>
            props.act(() => {
              const { rolled, paid } = exchangeLoot(w, data);
              return `The loot is worth ${crowns(rolled)}; the traders pay ${crowns(paid)}.`;
            })
          }
        >
          Sell the loot
        </button>
      </section>
      <section class="panel" aria-label="Healer">
        <h2>Healer</h2>
        <table class="healer">
          <tbody>
            {w.members.map((m) => {
              const c = m.character;
              return (
                <tr key={m.id}>
                  <th scope="row">{c.name}</th>
                  <td>
                    {m.dead ? 'dead' : `HP ${c.hp.current}/${c.hp.max}${m.frail ? ', Frail' : ''}`}
                  </td>
                  <td class="actions">
                    {!m.dead && c.hp.current < c.hp.max && (
                      <button
                        type="button"
                        onClick={() => props.act(() => healerHeal(w, data, m.id))}
                      >
                        Heal ({price(healListed(data, m))})
                      </button>
                    )}
                    {!m.dead && m.frail && (
                      <button
                        type="button"
                        onClick={() => props.act(() => cureFrail(w, data, m.id))}
                      >
                        Cure Frailty ({price(rules.healer.cureFrail)})
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {raiser && (
        <section class="panel" aria-label={raiser.raises === 'crypt' ? 'Crypt' : 'Mortuary'}>
          <h2>{raiser.raises === 'crypt' ? 'Crypt' : 'Mortuary'}</h2>
          <p class="hint">{raiser.text}</p>
          {dead.length === 0 && <p class="hint">No one in the party is dead.</p>}
          {dead.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => props.act(() => raiseDead(w, data, m.id))}
            >
              Raise {m.character.name} ({price(raiseListed(data, m))})
            </button>
          ))}
        </section>
      )}
    </>
  );
}
