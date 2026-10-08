import { useState } from 'preact/hooks';
import { keepAsMount, tamers, tamesInto } from '../../game/world/mounts.ts';
import { monsterOf } from '../../game/world/npcs.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { data } from '../builder/data.ts';

/** Keeping an offered beast as a mount instead (docs/rules-adaptation.md, Mounts: Taming). */
export function TameMount(props: { world: World; run: (action: () => TownResult) => void }) {
  const w = props.world;
  const beast = w.encounter?.beast;
  const [who, setWho] = useState('');
  const kept = beast ? tamesInto(data, beast) : undefined;
  const people = tamers(w, data);
  const tamer = people.find((m) => m.id === who) ?? people[0];
  if (!kept || !tamer) return null;
  return (
    <div class="beast" role="group" aria-label="Tame as a mount">
      <p class="hint">
        Or keep it as a {monsterOf(data, kept.monster).name}, for the same rations, outside the NPC
        slots.
      </p>
      <label>
        Tamer{' '}
        <select value={tamer.id} onChange={(ev) => setWho((ev.target as HTMLSelectElement).value)}>
          {people.map((m) => (
            <option key={m.id} value={m.id}>
              {m.character.name}
            </option>
          ))}
        </select>
      </label>{' '}
      <button type="button" onClick={() => props.run(() => keepAsMount(w, data, tamer.id))}>
        Tame as a mount
      </button>
    </div>
  );
}
