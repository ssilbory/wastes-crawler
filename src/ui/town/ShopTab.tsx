import { useState } from 'preact/hooks';
import type { ItemLocation } from '../../data/schemas/index.ts';
import { buyable, type CatalogItem } from '../../game/character/items.ts';
import { buy, giveItem, sell, sellPrice, setLocation, shopPrice } from '../../game/world/shop.ts';
import type { World } from '../../game/world/types.ts';
import { crowns, entryText } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

const KINDS: Record<CatalogItem['kind'], string> = {
  weapon: 'Weapons',
  armor: 'Armor',
  shield: 'Shields',
  gear: 'Gear',
  bundle: 'Bundles',
};
const LOCATIONS: ItemLocation[] = ['worn', 'readied', 'stowed'];
const stock = buyable(data);

/** The shop: SRD gear at this town's prices, and each member's pack. */
export function ShopTab(props: { world: World; act: Act }) {
  const w = props.world;
  const living = w.members.filter((m) => !m.dead);
  const [who, setWho] = useState(living[0]?.id ?? '');
  const [item, setItem] = useState(stock[0]?.id ?? '');
  const m = living.find((x) => x.id === who) ?? living[0];
  if (!m) return <p class="hint">No one living can shop.</p>;
  const others = living.filter((x) => x !== m);
  return (
    <>
      <section class="panel" aria-label="Buy">
        <h2>Buy</h2>
        <label>
          For{' '}
          <select value={m.id} onChange={(e) => setWho((e.target as HTMLSelectElement).value)}>
            {living.map((x) => (
              <option key={x.id} value={x.id}>
                {x.character.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Item{' '}
          <select value={item} onChange={(e) => setItem((e.target as HTMLSelectElement).value)}>
            {(Object.keys(KINDS) as CatalogItem['kind'][]).map((kind) => (
              <optgroup key={kind} label={KINDS[kind]}>
                {stock
                  .filter((i) => i.kind === kind)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({crowns(shopPrice(w, data, i.id))})
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>{' '}
        <button type="button" onClick={() => props.act(() => buy(w, data, m.id, item))}>
          Buy
        </button>
      </section>
      <section class="panel" aria-label={`${m.character.name}'s pack`}>
        <h2>{m.character.name}'s pack</h2>
        <ul class="pack">
          {m.character.inventory.map((entry, i) => (
            <li key={`${entry.id}-${i}`}>
              <span>{entryText(data, entry)}</span>
              <select
                aria-label={`Where ${entry.id} is carried`}
                value={entry.location}
                onChange={(e) =>
                  props.act(() =>
                    setLocation(
                      w,
                      data,
                      m.id,
                      i,
                      (e.target as HTMLSelectElement).value as ItemLocation,
                    ),
                  )
                }
              >
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => props.act(() => sell(w, data, m.id, i))}>
                Sell ({crowns(sellPrice(data, entry))})
              </button>
              {others.length > 0 && (
                <select
                  aria-label={`Give ${entry.id} to`}
                  value=""
                  onChange={(e) => {
                    const to = (e.target as HTMLSelectElement).value;
                    if (to) props.act(() => giveItem(w, data, m.id, i, to));
                  }}
                >
                  <option value="">Give to…</option>
                  {others.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.character.name}
                    </option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
