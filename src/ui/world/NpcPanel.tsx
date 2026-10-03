import { useState } from 'preact/hooks';
import { firstAid, healers } from '../../game/world/first-aid.ts';
import { dismiss } from '../../game/world/hire.ts';
import { captiveOf, MAX_NPCS, typeOf } from '../../game/world/npcs.ts';
import { regionMap } from '../../game/world/region.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { Npc, World } from '../../game/world/types.ts';
import { data } from '../builder/data.ts';

function role(w: World, n: Npc): string {
  const t = typeOf(data, n);
  if (t) return `${t.name}, ${t.wage} crowns a day`;
  const to = captiveOf(data, n.type).destination;
  const town = regionMap(data, w.region).sites.find((s) => s.id === to)?.name ?? to;
  return `rescued, bound for ${town}`;
}

/** The NPC slots, and first aid for anyone hurt. */
export function NpcPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const medics = healers(w, data);
  const hurt = [
    ...w.members
      .filter((m) => !m.dead && m.character.hp.current < m.character.hp.max)
      .map((m) => ({ id: m.id, name: m.character.name })),
    ...w.npcs.filter((n) => n.hp < n.maxHp).map((n) => ({ id: n.id, name: n.name })),
  ];
  const [healer, setHealer] = useState('');
  const [patient, setPatient] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  const by = medics.find((h) => h.id === healer) ?? medics[0];
  const to = hurt.find((p) => p.id === patient) ?? hurt[0];
  return (
    <section class="panel npc-panel" aria-label="NPCs">
      <h3>
        NPCs ({w.npcs.length}/{MAX_NPCS})
      </h3>
      {w.npcs.length === 0 && <p class="hint">Hire help at a tavern, or rescue captives.</p>}
      <ul class="tavern-list">
        {w.npcs.map((n) => (
          <li key={n.id}>
            <span>
              <strong>{n.name}</strong> {role(w, n)} · HP {n.hp}/{n.maxHp}
              {n.quitting && ' · leaving at the next town'}
              {n.inventory.length > 0 && ` · carrying ${n.inventory.length} items`}
            </span>
            <button type="button" onClick={() => run(() => dismiss(w, n.id))}>
              Dismiss
            </button>
          </li>
        ))}
      </ul>
      {by && to && !w.encounter && (
        <div class="first-aid" role="group" aria-label="First aid">
          <label>
            Healer{' '}
            <select
              value={by.id}
              onChange={(e) => setHealer((e.target as HTMLSelectElement).value)}
            >
              {medics.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>{' '}
          <label>
            Patient{' '}
            <select
              value={to.id}
              onChange={(e) => setPatient((e.target as HTMLSelectElement).value)}
            >
              {hurt.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>{' '}
          <button type="button" onClick={() => run(() => firstAid(w, data, by.id, to.id))}>
            First aid
          </button>
        </div>
      )}
      {message && <p class="hint">{message}</p>}
    </section>
  );
}
