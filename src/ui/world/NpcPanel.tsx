import { useState } from 'preact/hooks';
import { firstAid, healers } from '../../game/world/first-aid.ts';
import { dismiss } from '../../game/world/hire.ts';
import { captiveOf, MAX_NPCS, typeOf } from '../../game/world/npcs.ts';
import { regionMap } from '../../game/world/region.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { Npc, World } from '../../game/world/types.ts';
import { shareText } from '../../game/world/wording.ts';
import { data } from '../builder/data.ts';

function escortTo(questId: string): string {
  const step = data.content.quests.find((q) => q.id === questId)?.objectives[0];
  return step?.kind === 'escort' ? step.to : questId;
}

function role(w: World, n: Npc): string {
  const t = typeOf(data, n);
  if (
    n.kind === 'undead' ||
    n.kind === 'beast' ||
    n.kind === 'summon' ||
    n.kind === 'tree' ||
    n.kind === 'companion'
  ) {
    const master = w.members.find((m) => m.id === n.master)?.character.name;
    const kind = {
      undead: 'undead, serving',
      beast: 'beast, following',
      summon: 'summoned until dawn, serving',
      tree: 'woken tree, serving',
      companion: n.chosen ? 'chosen friend of' : 'companion of',
    }[n.kind];
    return master ? `${kind} ${master}` : n.kind;
  }
  if (n.kind === 'pack') return 'pack beast';
  if (t) return `${t.name}, ${shareText(t.share)}${n.owed > 0 ? `, owed ${n.owed} crowns` : ''}`;
  const to = n.kind === 'captive' ? captiveOf(data, n.type).destination : escortTo(n.type);
  const town = regionMap(data, w.region).sites.find((s) => s.id === to)?.name ?? to;
  return `${n.kind === 'captive' ? 'rescued' : 'escorted'}, bound for ${town}`;
}

/** The NPC slots, and first aid for anyone hurt. */
export function NpcPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const medics = healers(w, data);
  const hurt = [
    ...w.members
      .filter((m) => !m.dead && m.character.hp.current < m.character.hp.max)
      .map((m) => ({ id: m.id, name: m.character.name })),
    ...w.npcs
      // Bandages do nothing for the undead, summoned servants, or trees.
      .filter((n) => !['undead', 'summon', 'tree'].includes(n.kind) && n.hp < n.maxHp)
      .map((n) => ({ id: n.id, name: n.name })),
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
            <button type="button" onClick={() => run(() => dismiss(w, data, n.id))}>
              {n.kind === 'undead' || n.kind === 'summon'
                ? 'Release'
                : n.kind === 'companion'
                  ? 'Send away'
                  : n.kind === 'beast' || n.kind === 'pack'
                    ? 'Set loose'
                    : n.kind === 'tree'
                      ? 'Let it root'
                      : 'Dismiss'}
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
