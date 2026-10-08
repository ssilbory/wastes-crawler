import { useState } from 'preact/hooks';
import {
  load,
  mountCapacity,
  mountType,
  releaseMount,
  rides,
  setRider,
} from '../../game/world/mounts.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { data } from '../builder/data.ts';

/** The party's riding and war mounts, and who rides them (docs/rules-adaptation.md, Mounts). */
export function MountsPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  if (w.mounts.length === 0) return null;
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  const living = w.members.filter((m) => !m.dead);
  return (
    <section class="panel npc-panel" aria-label="Mounts">
      <h3>Mounts</h3>
      <ul class="tavern-list">
        {w.mounts.map((m) => {
          const t = mountType(data, m.type);
          return (
            <li key={m.id}>
              <span>
                <strong>{m.name}</strong> {t.role === 'war' ? 'war mount' : 'riding mount'} · HP{' '}
                {m.hp}/{m.maxHp} · load {load(data, m)}/{mountCapacity(w, data, m)}
              </span>{' '}
              <select
                aria-label={`${m.name}'s rider`}
                value={living.some((x) => x.id === m.rider) ? (m.rider ?? '') : ''}
                onChange={(e) => {
                  const to = (e.target as HTMLSelectElement).value;
                  run(() => setRider(w, data, m.id, to === '' ? null : to));
                }}
              >
                <option value="">No rider</option>
                {living
                  .filter((x) => rides(data, x, t))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.character.name}
                    </option>
                  ))}
              </select>{' '}
              <button type="button" onClick={() => run(() => releaseMount(w, data, m.id))}>
                Set loose
              </button>
            </li>
          );
        })}
      </ul>
      {w.dungeon && <p class="hint">The mounts wait at the entrance.</p>}
      {message && <p class="hint">{message}</p>}
    </section>
  );
}
