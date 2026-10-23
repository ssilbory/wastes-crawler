import { useState } from 'preact/hooks';
import {
  brewDifficulty,
  brewItem,
  canBrew,
  brewCost,
  recipeOf,
  startBrew,
} from '../../game/world/brewing.ts';
import { partsText } from '../../game/world/components.ts';
import { priceHere } from '../../game/world/town.ts';
import type { World } from '../../game/world/types.ts';
import { daysText } from '../../game/world/wording.ts';
import { crowns } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

const alchemy = data.content.alchemy;

/** Brewing potions (docs/rules-adaptation.md, Potions: Brewing). */
export function BrewPanel(props: { world: World; act: Act }) {
  const w = props.world;
  const brewers = w.members.filter((m) => !m.dead && canBrew(data, m));
  const [who, setWho] = useState(brewers[0]?.id ?? '');
  const [item, setItem] = useState(alchemy.recipes[0]?.item ?? '');
  const [doses, setDoses] = useState(1);
  const m = brewers.find((x) => x.id === who) ?? brewers[0];
  return (
    <section class="panel" aria-label="Brew">
      <h2>Brew</h2>
      {!m ? (
        <p class="hint">No one in the party has the Alchemy skill.</p>
      ) : (
        <>
          <label>
            Brewer{' '}
            <select value={m.id} onChange={(e) => setWho((e.target as HTMLSelectElement).value)}>
              {brewers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.character.name}
                </option>
              ))}
            </select>
          </label>{' '}
          <label>
            Brew{' '}
            <select value={item} onChange={(e) => setItem((e.target as HTMLSelectElement).value)}>
              {alchemy.recipes.map((r) => (
                <option key={r.item} value={r.item}>
                  {brewItem(data, r.item).name}
                </option>
              ))}
            </select>
          </label>{' '}
          <label>
            Batch{' '}
            <select
              value={doses}
              onChange={(e) => setDoses(Number((e.target as HTMLSelectElement).value))}
            >
              {alchemy.batches.map((b) => (
                <option key={b.doses} value={b.doses}>
                  {b.doses} {b.doses === 1 ? 'dose' : 'doses'}
                </option>
              ))}
            </select>
          </label>{' '}
          <p class="hint">
            Int/Alchemy against {brewDifficulty(data, item, doses)}, +1 with another brewer in the
            party; a failed brew is lost. Takes an {alchemy.kit.name} and{' '}
            {partsText(recipeOf(data, item).components)}.
          </p>
          <button
            type="button"
            onClick={() => props.act(() => startBrew(w, data, m.id, item, doses))}
          >
            Start ({crowns(priceHere(w, data, brewCost(data, item)))}, {daysText(alchemy.brewDays)})
          </button>
        </>
      )}
    </section>
  );
}
