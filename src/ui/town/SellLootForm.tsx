import { useState } from 'preact/hooks';
import { exchangeLoot } from '../../game/world/shop.ts';
import type { World } from '../../game/world/types.ts';
import { crowns, lootText } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

/** Sells the loot dice to the town's traders: all of them unless fewer of a size are picked. */
export function SellLootForm(props: { world: World; act: Act }) {
  const w = props.world;
  // Starts at everything carried; a change to the loot starts it afresh.
  return <Picker key={lootText(w.loot)} world={w} act={props.act} />;
}

function Picker(props: { world: World; act: Act }) {
  const w = props.world;
  const [counts, setCounts] = useState(() => w.loot.map((d) => d.count));
  const selling = w.loot.map((d, i) => ({ sides: d.sides, count: counts[i] ?? d.count }));
  const all = selling.every((d, i) => d.count === w.loot[i]?.count);
  return (
    <div class="sell-loot">
      <p>Loot carried: {lootText(w.loot)}</p>
      {w.loot.map((d, i) => (
        <label key={d.sides} class="field">
          <span>d{d.sides} to sell</span>
          <input
            type="number"
            min={0}
            max={d.count}
            step={1}
            value={counts[i] ?? d.count}
            onInput={(e) => {
              const n = Math.max(
                0,
                Math.min(d.count, Math.floor(Number((e.target as HTMLInputElement).value) || 0)),
              );
              setCounts(w.loot.map((x, j) => (j === i ? n : (counts[j] ?? x.count))));
            }}
          />{' '}
          of {d.count}
        </label>
      ))}
      <button
        type="button"
        disabled={selling.every((d) => d.count === 0)}
        onClick={() =>
          props.act(() => {
            const { rolled, paid } = exchangeLoot(w, data, selling);
            return `The loot is worth ${crowns(rolled)}; the traders pay ${crowns(paid)}.`;
          })
        }
      >
        {all ? 'Sell the loot' : 'Sell the chosen loot'}
      </button>
    </div>
  );
}
