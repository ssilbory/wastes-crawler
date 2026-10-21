import { useState } from 'preact/hooks';
import type { ItemLocation } from '../../data/schemas/index.ts';
import { buyable, type CatalogItem } from '../../game/character/items.ts';
import { carriers, stowWith, takeFrom, type Carrier } from '../../game/world/loads.ts';
import type { Size } from '../../game/character/gear.ts';
import {
  buy,
  fitSizeOf,
  giveItem,
  sell,
  sellPrice,
  setLocation,
  shopPrice,
} from '../../game/world/shop.ts';
import { load } from '../../game/world/mounts.ts';
import type { World } from '../../game/world/types.ts';
import { itemStats } from '../../render/gear-view.ts';
import { crowns, entryText } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import { cue } from '../sound.ts';
import { SellLootForm } from './SellLootForm.tsx';
import type { Act } from './TownScreen.tsx';

const KINDS: Record<CatalogItem['kind'], string> = {
  weapon: 'Weapons',
  armor: 'Armor',
  shield: 'Shields',
  gear: 'Gear',
  potion: 'Potions',
  scroll: 'Scrolls',
  bundle: 'Bundles',
};
const CARRIER: Record<Carrier['kind'], string> = {
  porter: 'porter',
  pack: 'pack beast',
  mount: 'mount',
};
const LOCATIONS: ItemLocation[] = ['worn', 'readied', 'stowed'];
const stock = buyable(data);

/** The shop: SRD gear at this town's prices, and each member's pack. */
export function ShopTab(props: { world: World; act: Act }) {
  const w = props.world;
  const living = w.members.filter((m) => !m.dead);
  const [who, setWho] = useState(living[0]?.id ?? '');
  const [item, setItem] = useState(stock[0]?.id ?? '');
  const [size, setSize] = useState<Size | null>(null);
  const m = living.find((x) => x.id === who) ?? living[0];
  if (!m) return <p class="hint">No one living can shop.</p>;
  const armor = stock.find((i) => i.id === item)?.kind === 'armor';
  const shownSize: Size = size ?? fitSizeOf(data, m);
  const others = living.filter((x) => x !== m);
  const porters = carriers(w, data);
  return (
    <>
      <section class="panel" aria-label="Sell loot">
        <h2>Sell loot</h2>
        <SellLootForm world={w} act={props.act} />
      </section>
      <section class="panel" aria-label="Buy">
        <h2>Buy</h2>
        <label>
          For{' '}
          <select
            value={m.id}
            onChange={(e) => {
              setWho((e.target as HTMLSelectElement).value);
              setSize(null);
            }}
          >
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
                      {i.name}
                      {itemStats(data, i) ? ` · ${itemStats(data, i)}` : ''} (
                      {crowns(shopPrice(w, data, i.id))})
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>{' '}
        {armor && (
          <>
            <label>
              Size{' '}
              <select
                value={shownSize}
                onChange={(e) => setSize((e.target as HTMLSelectElement).value as Size)}
              >
                <option value="standard">standard</option>
                <option value="small">small</option>
              </select>
            </label>{' '}
          </>
        )}
        <button
          type="button"
          onClick={() =>
            props.act(() => cue(buy(w, data, m.id, item, armor ? shownSize : undefined), 'coin'))
          }
        >
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
                Sell ({crowns(sellPrice(w, data, entry))})
              </button>
              {others.length + porters.length > 0 && (
                <select
                  aria-label={`Give ${entry.id} to`}
                  value=""
                  onChange={(e) => {
                    const to = (e.target as HTMLSelectElement).value;
                    if (porters.some((p) => p.holder.id === to))
                      props.act(() => stowWith(w, data, m.id, i, to));
                    else if (to) props.act(() => giveItem(w, data, m.id, i, to));
                  }}
                >
                  <option value="">Give to…</option>
                  {others.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.character.name}
                    </option>
                  ))}
                  {porters.map((p) => (
                    <option key={p.holder.id} value={p.holder.id}>
                      {p.holder.name} ({CARRIER[p.kind]})
                    </option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
      </section>
      {porters.map(({ holder: p, capacity }) => (
        <section key={p.id} class="panel" aria-label={`${p.name}'s load`}>
          <h2>
            {p.name}'s load ({load(data, p)}/{capacity})
          </h2>
          {p.inventory.length === 0 && <p class="hint">Nothing yet.</p>}
          <ul class="pack">
            {p.inventory.map((entry, i) => (
              <li key={`${entry.id}-${i}`}>
                <span>{entryText(data, entry)}</span>
                <button
                  type="button"
                  onClick={() => props.act(() => takeFrom(w, data, p.id, i, m.id))}
                >
                  Give to {m.character.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
