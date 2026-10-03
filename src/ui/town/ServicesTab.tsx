import {
  cureFrail,
  healListed,
  innListed,
  raiseDead,
  raiseListed,
  stayAtInn,
  templeHeal,
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
      <section class="panel" aria-label="Temple">
        <h2>Temple</h2>
        <table class="temple">
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
                        onClick={() => props.act(() => templeHeal(w, data, m.id))}
                      >
                        Heal ({price(healListed(data, m))})
                      </button>
                    )}
                    {!m.dead && m.frail && (
                      <button
                        type="button"
                        onClick={() => props.act(() => cureFrail(w, data, m.id))}
                      >
                        Cure Frailty ({price(rules.temple.cureFrail)})
                      </button>
                    )}
                    {m.dead && (
                      <button
                        type="button"
                        onClick={() => props.act(() => raiseDead(w, data, m.id))}
                      >
                        Raise ({price(raiseListed(data, m))})
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
