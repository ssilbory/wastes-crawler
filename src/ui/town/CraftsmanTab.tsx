import { useState } from 'preact/hooks';
import { findItem } from '../../game/character/items.ts';
import { collect, commission } from '../../game/world/commissions.ts';
import { componentName } from '../../game/world/components.ts';
import {
  buyComponent,
  buyGoods,
  buyMagic,
  componentPrice,
  craftsmanHere,
  craftsmanState,
  goodsPiece,
  magicStockPrice,
  sellComponent,
  sellLootTo,
  visitCraftsman,
  wares,
} from '../../game/world/craftsmen.ts';
import type { World } from '../../game/world/types.ts';
import { crowns } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';
import { abilitiesFor } from '../../game/world/forging.ts';
import { goodsPrice, modsFor } from '../../game/world/smith-mods.ts';
import { pieceName, pieceTerms, type Piece } from '../../game/world/smith-work.ts';

const rules = data.content.craftingRules;
const itemName = (id: string) => findItem(data, id)?.name ?? id;

/** The town's craftsman (docs/rules-adaptation.md, Crafting and modifying gear: Craftsmen). */
export function CraftsmanTab(props: { world: World; act: Act }) {
  const w = props.world;
  const c = craftsmanHere(w, data);
  const living = w.members.filter((m) => !m.dead);
  const [who, setWho] = useState(living[0]?.id ?? '');
  const [weapon, setWeapon] = useState(c?.weapons[0] ?? '');
  const sized = (id: string) => (findItem(data, id)?.kind === 'armor' ? ' (sized to fit)' : '');
  const [bonus, setBonus] = useState(0);
  const [ability, setAbility] = useState('');
  const [master, setMaster] = useState(false);
  const [mod, setMod] = useState('');
  if (!c) return <p class="hint">No craftsman works here.</p>;
  const st = craftsmanState(w, data, c);
  const m = living.find((x) => x.id === who) ?? living[0];
  if (!st || !m)
    return (
      <section class="panel" aria-label={c.name}>
        <h2>{c.name}</h2>
        <p class="hint">{c.text}</p>
        <button type="button" onClick={() => props.act(() => visitCraftsman(w, data))}>
          Call on {c.name}
        </button>
      </section>
    );
  // An ability or mod that doesn't fit the item chosen now falls back to none; only magic gear
  // takes an ability.
  const fit = bonus > 0 && abilitiesFor(data, weapon).some((a) => a.id === ability) ? ability : '';
  const mods = modsFor(data, c, weapon);
  const modFit = mods.some((x) => x.id === mod) ? mod : '';
  const piece: Piece = {
    weapon,
    ...(master ? { quality: 'mastercrafted' as const } : {}),
    ...(modFit ? { mod: modFit } : {}),
    ...(bonus > 0 ? { bonus } : {}),
    ...(fit ? { ability: fit } : {}),
  };
  const terms = pieceTerms(data, piece);
  const jobs = w.commissions.flatMap((j, i) => (j.craftsman === c.id ? [{ j, i }] : []));
  return (
    <>
      <section class="panel" aria-label={c.name}>
        <h2>{c.name}</h2>
        <p class="hint">{c.text}</p>
        <p>
          Craft-{c.craft}. Trade pool this month: {crowns(st.pool)}
        </p>
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
        <button
          type="button"
          disabled={w.loot.length === 0}
          onClick={() => props.act(() => sellLootTo(w, data))}
        >
          Sell loot dice to {c.name}
        </button>
        {w.loot.length === 0 && <p class="hint">No loot dice to sell.</p>}
      </section>
      <section class="panel" aria-label="Magic gear for sale">
        <h2>Magic weapons and armor for sale</h2>
        {st.stock.length === 0 && <p class="hint">Nothing ready-made this month.</p>}
        <ul>
          {st.stock.map((s, i) => (
            <li key={`${s.weapon}-${i}`}>
              {itemName(s.weapon)} +{s.bonus}
              {sized(s.weapon)}{' '}
              <button type="button" onClick={() => props.act(() => buyMagic(w, data, i, m.id))}>
                Buy ({crowns(magicStockPrice(data, s.weapon, s.bonus))})
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section class="panel" aria-label="Plain work for sale">
        <h2>Weapons and armor for sale</h2>
        {st.goods.length === 0 && <p class="hint">No plain work ready this month.</p>}
        <ul>
          {st.goods.map((g, i) => (
            <li key={`${g.item}-${i}`}>
              {pieceName(data, goodsPiece(g))}
              {sized(g.item)}{' '}
              <button type="button" onClick={() => props.act(() => buyGoods(w, data, i, m.id))}>
                Buy ({crowns(goodsPrice(data, goodsPiece(g)))})
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section class="panel" aria-label="Commissions">
        <h2>Commissions</h2>
        <label>
          Item{' '}
          <select value={weapon} onChange={(e) => setWeapon((e.target as HTMLSelectElement).value)}>
            {wares(c).map((id) => (
              <option key={id} value={id}>
                {itemName(id)}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          <input
            type="checkbox"
            checked={master}
            onChange={(e) => setMaster((e.target as HTMLInputElement).checked)}
          />{' '}
          Mastercrafted
        </label>{' '}
        <label>
          Mod{' '}
          <select value={modFit} onChange={(e) => setMod((e.target as HTMLSelectElement).value)}>
            <option value="">none</option>
            {mods.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
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
            <option value="0">none</option>
            {rules.magic.tiers.map((t) => (
              <option key={t.bonus} value={String(t.bonus)}>
                +{t.bonus}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Ability{' '}
          <select
            value={fit}
            disabled={bonus === 0}
            onChange={(e) => setAbility((e.target as HTMLSelectElement).value)}
          >
            <option value="">none</option>
            {abilitiesFor(data, weapon).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <button type="button" onClick={() => props.act(() => commission(w, data, piece))}>
          Commission ({crowns(terms.crowns)}, {terms.days} days
          {terms.components.length > 0 &&
            `, ${terms.components.map((x) => `${x.count} ${x.type}`).join(', ')}`}
          )
        </button>
        <ul>
          {jobs.map(({ j, i }) => (
            <li key={`${j.weapon}-${i}`}>
              {pieceName(data, j)}:{' '}
              {w.day >= j.readyDay ? (
                <button type="button" onClick={() => props.act(() => collect(w, data, i, m.id))}>
                  Collect for {m.character.name}
                </button>
              ) : (
                `ready in ${j.readyDay - w.day} days`
              )}
            </li>
          ))}
        </ul>
      </section>
      <section class="panel" aria-label="Components trade">
        <h2>Components</h2>
        <ul>
          {data.content.components.map((comp) => (
            <li key={comp.id}>
              {componentName(data, comp.id)} ({comp.type}): carried {w.components[comp.id] ?? 0}, in
              stock {st.parts[comp.id] ?? 0}{' '}
              <button
                type="button"
                disabled={!w.components[comp.id]}
                onClick={() => props.act(() => sellComponent(w, data, comp.id))}
              >
                Sell ({crowns(componentPrice(data, comp.id))})
              </button>{' '}
              <button
                type="button"
                disabled={!st.parts[comp.id]}
                onClick={() => props.act(() => buyComponent(w, data, comp.id))}
              >
                Buy ({crowns(componentPrice(data, comp.id) * rules.craftsmen.sellMarkup)})
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
