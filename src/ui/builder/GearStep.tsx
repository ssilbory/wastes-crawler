import { useState } from 'preact/hooks';
import type { ItemLocation, People } from '../../data/schemas/index.ts';
import type { GearChoice, StepStatus } from '../../game/character/creation.ts';
import {
  buyable,
  entryPrice,
  findItem,
  type CatalogItem,
  type InventoryEntry,
} from '../../game/character/items.ts';
import { data } from './data.ts';
import { Select, Step } from './Field.tsx';

const LOCATIONS: { value: ItemLocation; label: string }[] = [
  { value: 'worn', label: 'Worn' },
  { value: 'readied', label: 'Readied' },
  { value: 'stowed', label: 'Stowed' },
];

const shopItems = buyable(data);

export function crowns(tenths: number): string {
  return `${tenths / 10} crowns`;
}

export function entryName(entry: InventoryEntry): string {
  const name = findItem(data, entry.id)?.name ?? entry.id;
  const tags = [entry.small ? 'small' : '', entry.barding ? 'barding' : ''].filter(Boolean);
  const qty = entry.quantity > 1 ? ` ×${entry.quantity}` : '';
  return `${name}${tags.length ? ` (${tags.join(', ')})` : ''}${qty}`;
}

function defaultLocation(item: CatalogItem, items: readonly InventoryEntry[]): ItemLocation {
  if (item.kind === 'weapon') return 'readied';
  if (item.kind !== 'armor' && item.kind !== 'shield') return 'stowed';
  const wornSame = items.some(
    (e) => e.location === 'worn' && findItem(data, e.id)?.kind === item.kind,
  );
  return wornSame ? 'stowed' : 'worn';
}

/** Shop mode: buy from the SRD lists with rolled crowns, and place each item. */
function Shop(props: {
  people: People;
  choice: Extract<GearChoice, { mode: 'shop' }>;
  onRoll: () => void;
  onChange: (items: InventoryEntry[]) => void;
}) {
  const [pick, setPick] = useState('');
  const [barding, setBarding] = useState(false);
  const { choice } = props;
  if (choice.crowns === null) {
    return (
      <button type="button" onClick={props.onRoll}>
        Roll 3d6 × 10 crowns
      </button>
    );
  }
  const picked = shopItems.find((i) => i.id === pick);
  const buy = () => {
    if (!picked) return;
    const entry: InventoryEntry = {
      id: picked.id,
      quantity: 1,
      location: barding ? 'worn' : defaultLocation(picked, choice.items),
    };
    if (picked.kind === 'armor' && props.people.size === 'small' && !barding) entry.small = true;
    if (picked.kind === 'armor' && barding) entry.barding = true;
    props.onChange([...choice.items, entry]);
  };
  const setLocation = (i: number, location: ItemLocation) =>
    props.onChange(choice.items.map((e, j) => (j === i ? { ...e, location } : e)));
  return (
    <div class="shop">
      <p>Starting purse: {choice.crowns} crowns.</p>
      <Select
        label="Item to buy"
        value={pick}
        options={shopItems.map((i) => ({
          value: i.id,
          label: `${i.name} (${crowns(entryPrice(data, i, { id: i.id, quantity: 1, location: 'stowed' }))})`,
        }))}
        onChange={setPick}
      />
      {props.people.barding && picked?.kind === 'armor' && (
        <label>
          <input
            type="checkbox"
            checked={barding}
            onChange={(e) => setBarding((e.target as HTMLInputElement).checked)}
          />
          As barding (double cost)
        </label>
      )}
      <button type="button" disabled={!picked} onClick={buy}>
        Buy
      </button>
      <ul class="inventory">
        {choice.items.map((entry, i) => (
          <li key={i}>
            <span>{entryName(entry)}</span>
            <Select
              label={`Location for ${entryName(entry)}`}
              value={entry.location}
              options={LOCATIONS}
              placeholder="–"
              onChange={(v) => v && setLocation(i, v as ItemLocation)}
            />
            <button
              type="button"
              onClick={() => props.onChange(choice.items.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** SRD 1.7.7: a starting package, or 3d6 x 10 crowns to spend. */
export function GearStep(props: {
  people: People | undefined;
  choice: GearChoice | null;
  inventory: readonly InventoryEntry[];
  crownsTenths: number;
  status: StepStatus;
  onRoll: () => void;
  onChange: (choice: GearChoice) => void;
}) {
  const { choice, people } = props;
  const pkg =
    choice?.mode === 'package'
      ? data.content.startingPackages.find((p) => p.id === choice.packageId)
      : undefined;
  return (
    <Step title="8. Gear" status={props.status}>
      {!people && <p class="hint">Choose a people and attributes first.</p>}
      {people && (
        <>
          <fieldset class="mode">
            <legend>Starting gear</legend>
            <label>
              <input
                type="radio"
                name="gear-mode"
                checked={choice?.mode === 'package'}
                onChange={() => props.onChange({ mode: 'package', packageId: null })}
              />
              Starting package
            </label>
            <label>
              <input
                type="radio"
                name="gear-mode"
                checked={choice?.mode === 'shop'}
                onChange={() => props.onChange({ mode: 'shop', crowns: null, items: [] })}
              />
              Roll for crowns and shop
            </label>
          </fieldset>
          {choice?.mode === 'package' && (
            <>
              <Select
                label="Package"
                value={choice.packageId ?? ''}
                options={data.content.startingPackages.map((p) => ({ value: p.id, label: p.name }))}
                onChange={(v) =>
                  props.onChange({ mode: 'package', packageId: v === '' ? null : v })
                }
              />
              {pkg && <p class="hint">{pkg.description}</p>}
              <ul class="inventory">
                {props.inventory.map((e, i) => (
                  <li key={i}>
                    {entryName(e)}: {e.location}
                  </li>
                ))}
              </ul>
            </>
          )}
          {choice?.mode === 'shop' && (
            <Shop
              people={people}
              choice={choice}
              onRoll={props.onRoll}
              onChange={(items) => props.onChange({ ...choice, items })}
            />
          )}
          {choice && props.status.state === 'ok' && (
            <p class="hint">Left over: {crowns(props.crownsTenths)}.</p>
          )}
        </>
      )}
    </Step>
  );
}
