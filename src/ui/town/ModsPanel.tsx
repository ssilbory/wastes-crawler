import { useState } from 'preact/hooks';
import { findItem } from '../../game/character/items.ts';
import { componentName } from '../../game/world/components.ts';
import { capacity, upkeepNeed } from '../../game/world/maintenance.ts';
import { canMod, craftLevel, modMisfit, startMod, startStrip } from '../../game/world/mods.ts';
import type { World } from '../../game/world/types.ts';
import { crowns, entryText } from '../../render/town-view.ts';
import { priceHere } from '../../game/world/town.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

const mods = data.content.mods;

/** Building and stripping mods, the components carried, and who keeps the mods working. */
export function ModsPanel(props: { world: World; act: Act }) {
  const w = props.world;
  const modders = w.members.filter((m) => !m.dead && canMod(m));
  const lines = w.members.flatMap((m) =>
    m.character.inventory.flatMap((e, index) => {
      const kind = findItem(data, e.id)?.kind;
      return kind === 'weapon' || kind === 'armor' ? [{ m, e, index }] : [];
    }),
  );
  const [who, setWho] = useState(modders[0]?.id ?? '');
  const [target, setTarget] = useState('0');
  const [modId, setModId] = useState(mods[0]?.id ?? '');
  const crafter = modders.find((x) => x.id === who) ?? modders[0];
  const line = lines[Number(target)] ?? lines[0];
  const mod = mods.find((x) => x.id === modId) ?? (mods[0] as (typeof mods)[number]);
  const stash = Object.entries(w.components);
  const artisans = w.members.filter((m) => capacity(data, m) > 0);
  const upkeep = w.members.flatMap((m) =>
    m.character.inventory.flatMap((e) => (upkeepNeed(data, e) ? [{ m, e }] : [])),
  );
  return (
    <>
      <section class="panel" aria-label="Mods">
        <h2>Mods</h2>
        {!crafter || !line ? (
          <p class="hint">No one in the party can build mods.</p>
        ) : (
          <>
            <label>
              Crafter{' '}
              <select
                value={crafter.id}
                onChange={(e) => setWho((e.target as HTMLSelectElement).value)}
              >
                {modders.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.character.name} (Craft-{craftLevel(x)})
                  </option>
                ))}
              </select>
            </label>{' '}
            <label>
              Item{' '}
              <select
                value={target}
                onChange={(e) => setTarget((e.target as HTMLSelectElement).value)}
              >
                {lines.map((l, i) => (
                  <option key={`${l.m.id}-${l.index}`} value={String(i)}>
                    {l.m.character.name}: {entryText(data, l.e)}
                  </option>
                ))}
              </select>
            </label>{' '}
            <label>
              Mod{' '}
              <select
                value={mod.id}
                onChange={(e) => setModId((e.target as HTMLSelectElement).value)}
              >
                {mods.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} (Craft-{x.minCraft})
                  </option>
                ))}
              </select>
            </label>
            <p class="hint">
              {mod.text} Costs {mod.loot.count} loot dice of d{mod.loot.sides} or larger
              {mod.components.map((c) => `, ${c.count} ${c.type}`).join('')}. Dice short are paid in
              crowns, {mod.loot.sides} each.
            </p>
            {line.e.mods?.some((x) => x.id === mod.id) ? (
              <button
                type="button"
                onClick={() =>
                  props.act(() => startStrip(w, data, crafter.id, line.m.id, line.index, mod.id))
                }
              >
                Strip {mod.name}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={modMisfit(data, line.e, mod) !== null}
                  onClick={() =>
                    props.act(() => startMod(w, data, crafter.id, line.m.id, line.index, mod.id))
                  }
                >
                  Build {mod.name}
                </button>{' '}
                <button
                  type="button"
                  disabled={modMisfit(data, line.e, mod) !== null}
                  onClick={() =>
                    props.act(() =>
                      startMod(w, data, crafter.id, line.m.id, line.index, mod.id, 'crowns'),
                    )
                  }
                >
                  Build {mod.name}, dice in crowns (
                  {crowns(priceHere(w, data, mod.loot.count * mod.loot.sides))})
                </button>
              </>
            )}
          </>
        )}
      </section>
      <section class="panel" aria-label="Components">
        <h2>Components</h2>
        {stash.length === 0 && <p class="hint">None carried.</p>}
        <ul>
          {stash.map(([id, n]) => (
            <li key={id}>
              {componentName(data, id)} ×{n}
            </li>
          ))}
        </ul>
      </section>
      <section class="panel" aria-label="Maintenance">
        <h2>Maintenance</h2>
        <p class="hint">
          Each night, wherever the party is, artisans keep up mods and jury-rigged gear.
        </p>
        <ul>
          {artisans.map((m) => (
            <li key={m.id}>
              {m.character.name} can maintain {capacity(data, m)}
            </li>
          ))}
          {upkeep.map(({ m, e }) => (
            <li key={`${m.id}-${e.serial ?? e.id}`}>
              {m.character.name}: {entryText(data, e)}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
