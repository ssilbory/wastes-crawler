import { useState } from 'preact/hooks';
import {
  abandonProject,
  buildDays,
  buyWorkshop,
  canCraft,
  craftable,
  daysText,
  partsListed,
  startProject,
  tiersFor,
  workshopHere,
  type Tier,
} from '../../game/world/crafting.ts';
import type { Size } from '../../game/character/gear.ts';
import { fitSizeOf } from '../../game/world/shop.ts';
import { priceHere, townHere } from '../../game/world/town.ts';
import type { World } from '../../game/world/types.ts';
import { stayToWork, workDay } from '../../game/world/workshop.ts';
import { projectText } from '../../render/crafting-view.ts';
import { crowns } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import { BrewPanel } from './BrewPanel.tsx';
import { ModsPanel } from './ModsPanel.tsx';
import { ScribePanel } from './ScribePanel.tsx';
import type { Act } from './TownScreen.tsx';

const items = craftable(data);
const TIERS: Tier[] = ['jury-rigged', 'normal', 'mastercrafted'];

/** Crafting gear (docs/rules-adaptation.md, Crafting and modifying gear). */
export function WorkshopTab(props: { world: World; act: Act }) {
  const w = props.world;
  const crafters = w.members.filter((m) => !m.dead && canCraft(m));
  const [who, setWho] = useState(crafters[0]?.id ?? '');
  const [itemId, setItemId] = useState(items[0]?.id ?? '');
  const [tier, setTier] = useState<Tier>('normal');
  const [size, setSize] = useState<Size | null>(null);
  const shop = workshopHere(w, data);
  const rules = data.content.craftingRules.workshop;
  const town = townHere(w, data);
  const m = crafters.find((x) => x.id === who) ?? crafters[0];
  const item = items.find((i) => i.id === itemId) ?? items[0];
  const tiers = item ? tiersFor(item) : [];
  const t = tiers.includes(tier) ? tier : 'normal';
  const armor = item?.kind === 'armor';
  const sized: Size = size ?? (m ? fitSizeOf(data, m) : 'standard');
  return (
    <>
      <section class="panel" aria-label="Workshop">
        <h2>Workshop</h2>
        {!shop && <p class="hint">{town.name} has no workshop; work goes on in a made camp.</p>}
        {shop?.owned && <p>The party owns this workshop.</p>}
        {shop && !shop.owned && (
          <>
            <p class="hint">Rent: {crowns(priceHere(w, data, rules.rentPerDay))} a day.</p>
            <button type="button" onClick={() => props.act(() => buyWorkshop(w, data))}>
              Buy the workshop ({crowns(priceHere(w, data, rules.price))})
            </button>
          </>
        )}
      </section>
      <section class="panel" aria-label="Under way">
        <h2>Under way</h2>
        {w.projects.length === 0 && <p class="hint">Nothing is being made.</p>}
        <ul>
          {w.projects.map((p) => (
            <li key={p.crafter}>
              {projectText(w, data, p)}{' '}
              {shop && !p.staying && w.members.some((x) => x.id === p.crafter) && (
                <button
                  type="button"
                  onClick={() => props.act(() => stayToWork(w, data, p.crafter))}
                >
                  Stay to finish it
                </button>
              )}{' '}
              <button
                type="button"
                onClick={() => props.act(() => abandonProject(w, data, p.crafter))}
              >
                Give it up
              </button>
            </li>
          ))}
        </ul>
        {shop && (
          <button type="button" onClick={() => props.act(() => workDay(w, data))}>
            Work a day and sleep at the inn
          </button>
        )}
      </section>
      <section class="panel" aria-label="Make">
        <h2>Make</h2>
        {!m || !item ? (
          <p class="hint">No one in the party has the Craft skill.</p>
        ) : (
          <>
            <label>
              Crafter{' '}
              <select
                value={m.id}
                onChange={(e) => {
                  setWho((e.target as HTMLSelectElement).value);
                  setSize(null);
                }}
              >
                {crafters.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.character.name}
                  </option>
                ))}
              </select>
            </label>{' '}
            <label>
              Make{' '}
              <select
                value={item.id}
                onChange={(e) => setItemId((e.target as HTMLSelectElement).value)}
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>{' '}
            <label>
              Quality{' '}
              <select
                value={t}
                onChange={(e) => setTier((e.target as HTMLSelectElement).value as Tier)}
              >
                {TIERS.filter((x) => tiers.includes(x)).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>{' '}
            {armor && (
              <>
                <label>
                  Size{' '}
                  <select
                    value={sized}
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
                props.act(() => startProject(w, data, m.id, item.id, t, armor ? sized : undefined))
              }
            >
              Start ({crowns(priceHere(w, data, partsListed(data, item, t)))},{' '}
              {daysText(buildDays(data, item, t))})
            </button>
          </>
        )}
      </section>
      <BrewPanel world={w} act={props.act} />
      <ScribePanel world={w} act={props.act} />
      <ModsPanel world={w} act={props.act} />
    </>
  );
}
