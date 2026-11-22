import { useState } from 'preact/hooks';
import type { WizardPiece } from '../../data/schemas/index.ts';
import { partsText } from '../../game/world/components.ts';
import { priceHere } from '../../game/world/town-prices.ts';
import type { World } from '../../game/world/types.ts';
import {
  devicesOf,
  maxSpellLevel,
  pieceKind,
  traditionName,
  wizardMisfit,
  wizardPieceName,
  wizardSpells,
  wizardStockPrice,
  wizardTerms,
} from '../../game/world/wizard-wares.ts';
import {
  buyWizardPiece,
  collectWizardPiece,
  orderWizardPiece,
  visitWizard,
  wizardHere,
  wizardState,
} from '../../game/world/wizards.ts';
import { daysText } from '../../game/world/wording.ts';
import { crowns } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

const scroll = data.content.scrolls.scroll;

/** A spell picker: the wizard's spells that fit, or none for an optional third. */
function SpellPick(props: {
  label: string;
  value: string;
  spells: { id: string; name: string; level: number }[];
  optional?: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <label>
      {props.label}{' '}
      <select
        value={props.value}
        onChange={(e) => props.onPick((e.target as HTMLSelectElement).value)}
      >
        {props.optional && <option value="">none</option>}
        {props.spells.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.level})
          </option>
        ))}
      </select>
    </label>
  );
}

/** The settlement's wizard (docs/rules-adaptation.md, Potions, scrolls, and magic devices: Wizards). */
export function WizardTab(props: { world: World; act: Act }) {
  const w = props.world;
  const wz = wizardHere(w, data);
  const living = w.members.filter((m) => !m.dead);
  const [who, setWho] = useState(living[0]?.id ?? '');
  const [item, setItem] = useState(scroll.id);
  const [picks, setPicks] = useState<string[]>(['', '', '']);
  if (!wz) return <p class="hint">No wizard works here.</p>;
  const st = wizardState(w, data, wz);
  const m = living.find((x) => x.id === who) ?? living[0];
  if (!st || !m)
    return (
      <section class="panel" aria-label={wz.name}>
        <h2>{wz.name}</h2>
        <p class="hint">{wz.text}</p>
        <button type="button" onClick={() => props.act(() => visitWizard(w, data))}>
          Call on {wz.name}
        </button>
      </section>
    );
  const items = [
    scroll.id,
    ...devicesOf(data, wz, 'wand').map((d) => d.id),
    ...devicesOf(data, wz, 'staff').map((d) => d.id),
    ...devicesOf(data, wz, 'rod').map((d) => d.id),
  ];
  const kind = pieceKind(data, item);
  const spells =
    kind === 'rod' ? [] : wizardSpells(data, wz, kind === 'scroll' ? 'scroll' : 'device');
  // Each picker falls back to the first spell the wizard has; a staff's third is optional.
  const slots = kind === 'rod' ? 0 : kind === 'staff' ? 3 : 1;
  const chosen = Array.from({ length: slots }, (_, i) => {
    const p = picks[i] ?? '';
    if (spells.some((s) => s.id === p)) return p;
    return i === 2 ? '' : (spells[i]?.id ?? '');
  });
  const piece: WizardPiece = { item, spells: chosen.filter((x) => x !== '') };
  const misfit = wizardMisfit(data, wz, piece);
  const terms = misfit ? null : wizardTerms(data, piece);
  const orders = w.wizardOrders.flatMap((o, i) => (o.wizard === wz.id ? [{ o, i }] : []));
  const pickAt = (i: number) => (id: string) =>
    setPicks(picks.map((p, j) => (j === i ? id : (chosen[j] ?? p))));
  return (
    <>
      <section class="panel" aria-label={wz.name}>
        <h2>{wz.name}</h2>
        <p class="hint">{wz.text}</p>
        <p>
          A level {wz.level} {traditionName(wz)} wizard: spells up to level{' '}
          {maxSpellLevel(data, wz)}, of their tradition only.
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
        </label>
      </section>
      <section class="panel" aria-label="Scrolls and devices for sale">
        <h2>Scrolls and devices for sale</h2>
        {st.stock.length === 0 && <p class="hint">Nothing ready-made this month.</p>}
        <ul>
          {st.stock.map((p, i) => (
            <li key={`${p.item}-${i}`}>
              {wizardPieceName(data, p)}{' '}
              <button
                type="button"
                onClick={() => props.act(() => buyWizardPiece(w, data, i, m.id))}
              >
                Buy ({crowns(priceHere(w, data, wizardStockPrice(data, p)))})
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section class="panel" aria-label="Make to order">
        <h2>Make to order</h2>
        <label>
          Item{' '}
          <select value={item} onChange={(e) => setItem((e.target as HTMLSelectElement).value)}>
            {items.map((id) => (
              <option key={id} value={id}>
                {data.content.devices.devices.find((d) => d.id === id)?.name ?? scroll.name}
              </option>
            ))}
          </select>
        </label>{' '}
        {chosen.map((id, i) => (
          <SpellPick
            key={i}
            label={slots === 1 ? 'Spell' : `Spell ${i + 1}`}
            value={id}
            spells={spells}
            optional={i === 2}
            onPick={pickAt(i)}
          />
        ))}{' '}
        {misfit ? (
          <p class="hint">{misfit}</p>
        ) : (
          <button type="button" onClick={() => props.act(() => orderWizardPiece(w, data, piece))}>
            Order ({crowns(priceHere(w, data, terms?.crowns ?? 0))}, {daysText(terms?.days ?? 0)}
            {terms && terms.components.length > 0 && `, ${partsText(terms.components)}`})
          </button>
        )}
        <ul>
          {orders.map(({ o, i }) => (
            <li key={i}>
              {wizardPieceName(data, o)}
              {w.day < o.readyDay ? `, ready in ${daysText(o.readyDay - w.day)}` : ', ready'}{' '}
              {w.day >= o.readyDay && (
                <button
                  type="button"
                  onClick={() => props.act(() => collectWizardPiece(w, data, i, m.id))}
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
