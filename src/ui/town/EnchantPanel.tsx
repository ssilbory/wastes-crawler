import { useState } from 'preact/hooks';
import {
  canEnchant,
  deviceDifficulty,
  deviceListed,
  spellsMisfit,
  startDevice,
} from '../../game/world/enchanting.ts';
import { scribesOf } from '../../game/world/scribing.ts';
import { priceHere } from '../../game/world/town.ts';
import type { World } from '../../game/world/types.ts';
import { daysText } from '../../game/world/wording.ts';
import { crowns } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

const rules = data.content.devices;

/** Making wands, staves, and rods (docs/rules-adaptation.md, Potions, scrolls, and devices). */
export function EnchantPanel(props: { world: World; act: Act }) {
  const w = props.world;
  const makers = w.members.filter((m) => !m.dead && canEnchant(data, m));
  const [who, setWho] = useState(makers[0]?.id ?? '');
  const [deviceId, setDevice] = useState(rules.devices[0]?.id ?? '');
  const [picked, setPicked] = useState<string[]>([]);
  const m = makers.find((x) => x.id === who) ?? makers[0];
  const d = rules.devices.find((x) => x.id === deviceId) ?? rules.devices[0];
  if (!m || !d)
    return (
      <section class="panel" aria-label="Devices">
        <h2>Devices</h2>
        <p class="hint">No one in the party has Magic and Scribing 1.</p>
      </section>
    );
  // Any caster with Scribing 1 may write scrolls; the same spells fit in devices.
  const known = scribesOf(data, m);
  const spells =
    d.device.kind === 'rod' ? [] : picked.filter((id) => known.some((s) => s.id === id));
  const misfit = spellsMisfit(data, d, spells);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <section class="panel" aria-label="Devices">
      <h2>Devices</h2>
      <label>
        Maker{' '}
        <select value={m.id} onChange={(e) => setWho((e.target as HTMLSelectElement).value)}>
          {makers.map((x) => (
            <option key={x.id} value={x.id}>
              {x.character.name}
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        Make{' '}
        <select
          value={d.id}
          onChange={(e) => {
            setDevice((e.target as HTMLSelectElement).value);
            setPicked([]);
          }}
        >
          {rules.devices.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <p class="hint">{d.text}</p>
      {d.device.kind !== 'rod' && (
        <fieldset>
          <legend>Spells</legend>
          {known.length === 0 && <p class="hint">{m.character.name} knows no spell that fits.</p>}
          {known.map((s) => (
            <label key={s.id}>
              <input
                type="checkbox"
                checked={spells.includes(s.id)}
                onChange={() => toggle(s.id)}
              />{' '}
              {s.name} (level {s.level})
            </label>
          ))}
        </fieldset>
      )}
      {misfit ? (
        <p class="hint">{misfit}</p>
      ) : (
        <>
          <p class="hint">
            Int/Magic against {deviceDifficulty(data, d.id, spells)}, +1 with another maker in the
            party; a failed device is lost.
          </p>
          <button
            type="button"
            onClick={() => props.act(() => startDevice(w, data, m.id, d.id, spells))}
          >
            Start ({crowns(priceHere(w, data, deviceListed(data, d.id, spells)))},{' '}
            {daysText(rules.days)})
          </button>
        </>
      )}
    </section>
  );
}
