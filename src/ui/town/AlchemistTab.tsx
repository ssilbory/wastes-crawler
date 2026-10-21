import { useState } from 'preact/hooks';
import {
  alchemistHere,
  alchemistState,
  buyPotion,
  collectBrew,
  orderBrew,
  stockListed,
  visitAlchemist,
} from '../../game/world/alchemists.ts';
import { brewItem, reagentsListed } from '../../game/world/brewing.ts';
import { daysText } from '../../game/world/wording.ts';
import { priceHere } from '../../game/world/town.ts';
import type { World } from '../../game/world/types.ts';
import { crowns } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

const name = (id: string) => brewItem(data, id).name;
const DOSES = [1, 2, 3, 4];

/** The town's alchemist (docs/rules-adaptation.md, Potions: Alchemists). */
export function AlchemistTab(props: { world: World; act: Act }) {
  const w = props.world;
  const a = alchemistHere(w, data);
  const living = w.members.filter((m) => !m.dead);
  const [who, setWho] = useState(living[0]?.id ?? '');
  const [item, setItem] = useState(a?.wares[0] ?? '');
  const [doses, setDoses] = useState(1);
  if (!a) return <p class="hint">No alchemist works here.</p>;
  const st = alchemistState(w, data, a);
  const m = living.find((x) => x.id === who) ?? living[0];
  if (!st || !m)
    return (
      <section class="panel" aria-label={a.name}>
        <h2>{a.name}</h2>
        <p class="hint">{a.text}</p>
        <button type="button" onClick={() => props.act(() => visitAlchemist(w, data))}>
          Call on {a.name}
        </button>
      </section>
    );
  const ware = a.wares.includes(item) ? item : (a.wares[0] as string);
  const orders = w.brewOrders.flatMap((o, i) => (o.alchemist === a.id ? [{ o, i }] : []));
  const stock = Object.entries(st.stock);
  return (
    <>
      <section class="panel" aria-label={a.name}>
        <h2>{a.name}</h2>
        <p class="hint">{a.text}</p>
        <label>
          For{' '}
          <select value={m.id} onChange={(e) => setWho((e.target as HTMLSelectElement).value)}>
            {living.map((x) => (
              <option key={x.id} value={x.id}>
                {x.character.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section class="panel" aria-label="Potions for sale">
        <h2>Potions for sale</h2>
        {stock.length === 0 && <p class="hint">Nothing ready-made this month.</p>}
        <ul>
          {stock.map(([id, n]) => (
            <li key={id}>
              {name(id)} ({n} left){' '}
              <button type="button" onClick={() => props.act(() => buyPotion(w, data, id, m.id))}>
                Buy ({crowns(priceHere(w, data, stockListed(data, id)))})
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section class="panel" aria-label="Brew to order">
        <h2>Brew to order</h2>
        <p class="hint">Ready in {daysText(data.content.alchemy.brewDays)}, to collect here.</p>
        <label>
          Potion{' '}
          <select value={ware} onChange={(e) => setItem((e.target as HTMLSelectElement).value)}>
            {a.wares.map((id) => (
              <option key={id} value={id}>
                {name(id)}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Doses{' '}
          <select
            value={doses}
            onChange={(e) => setDoses(Number((e.target as HTMLSelectElement).value))}
          >
            {DOSES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>{' '}
        <button type="button" onClick={() => props.act(() => orderBrew(w, data, ware, doses))}>
          Order ({crowns(priceHere(w, data, reagentsListed(data, ware) * doses))})
        </button>
        <ul>
          {orders.map(({ o, i }) => (
            <li key={i}>
              {o.doses} × {name(o.item)}
              {w.day < o.readyDay ? `, ready in ${daysText(o.readyDay - w.day)}` : ', ready'}{' '}
              {w.day >= o.readyDay && (
                <button
                  type="button"
                  onClick={() => props.act(() => collectBrew(w, data, i, m.id))}
                >
                  Collect
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
