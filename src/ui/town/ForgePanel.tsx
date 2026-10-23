import { useState } from 'preact/hooks';
import { findItem } from '../../game/character/items.ts';
import type { Size } from '../../game/character/gear.ts';
import {
  abilitiesFor,
  canForge,
  forgeDifficulty,
  forgeTerms,
  forgeable,
  startForge,
} from '../../game/world/forging.ts';
import { fitSizeOf } from '../../game/world/shop.ts';
import { priceHere } from '../../game/world/town.ts';
import type { World } from '../../game/world/types.ts';
import { daysText } from '../../game/world/wording.ts';
import { crowns } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

const items = forgeable(data);
const name = (id: string) => findItem(data, id)?.name ?? id;

/** Forging magic weapons and armor (docs/rules-adaptation.md, Forged magic and Abilities). */
export function ForgePanel(props: { world: World; act: Act }) {
  const w = props.world;
  const smiths = w.members.filter((m) => !m.dead && canForge(data, m));
  const [who, setWho] = useState(smiths[0]?.id ?? '');
  const [item, setItem] = useState(items[0] ?? '');
  const [bonus, setBonus] = useState(1);
  const [ability, setAbility] = useState('');
  const [size, setSize] = useState<Size | null>(null);
  const m = smiths.find((x) => x.id === who) ?? smiths[0];
  if (!m)
    return (
      <section class="panel" aria-label="Forge">
        <h2>Forge</h2>
        <p class="hint">No one in the party has Magic 1 and Craft 1.</p>
      </section>
    );
  const fit = abilitiesFor(data, item).some((a) => a.id === ability) ? ability : '';
  const terms = forgeTerms(data, item, bonus, fit || undefined);
  const armor = findItem(data, item)?.kind === 'armor';
  const sized: Size = size ?? fitSizeOf(data, m);
  return (
    <section class="panel" aria-label="Forge">
      <h2>Forge</h2>
      <label>
        Smith{' '}
        <select value={m.id} onChange={(e) => setWho((e.target as HTMLSelectElement).value)}>
          {smiths.map((x) => (
            <option key={x.id} value={x.id}>
              {x.character.name}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        Item{' '}
        <select value={item} onChange={(e) => setItem((e.target as HTMLSelectElement).value)}>
          {items.map((id) => (
            <option key={id} value={id}>
              {name(id)}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        Bonus{' '}
        <select
          value={String(bonus)}
          onChange={(e) => setBonus(Number((e.target as HTMLSelectElement).value))}
        >
          {[1, 2, 3].map((b) => (
            <option key={b} value={String(b)}>
              +{b}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        Ability{' '}
        <select value={fit} onChange={(e) => setAbility((e.target as HTMLSelectElement).value)}>
          <option value="">none</option>
          {abilitiesFor(data, item).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>{' '}
      {armor && (
        <label>
          Size{' '}
          <select
            value={sized}
            onChange={(e) => setSize((e.target as HTMLSelectElement).value as Size)}
          >
            <option value="standard">standard</option>
            <option value="small">small</option>
          </select>
        </label>
      )}
      <p class="hint">
        Int/Magic against {forgeDifficulty(data, bonus, fit || undefined)}, +1 with another smith in
        the party. Needs {terms.components.map((x) => `${x.count} ${x.type}`).join(', ')}. A failure
        can be started over at full price or gone on with a flaw.
      </p>
      <button
        type="button"
        onClick={() =>
          props.act(() =>
            startForge(w, data, m.id, item, bonus, fit || undefined, armor ? sized : undefined),
          )
        }
      >
        Start ({crowns(priceHere(w, data, terms.crowns))}, {daysText(terms.days)})
      </button>
    </section>
  );
}
