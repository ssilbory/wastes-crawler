import { useState } from 'preact/hooks';
import { awake } from '../../game/world/members.ts';
import { playedTonight, playForLodging } from '../../game/world/perform.ts';
import { pray, prayedToday, type Prayer } from '../../game/world/prayer.ts';
import type { World } from '../../game/world/types.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

const able = (w: World) => w.members.filter(awake);

/** Playing the inn's common room for the party's lodging (docs/rules-adaptation.md, Skills). */
export function PerformForm(props: { world: World; act: Act }) {
  const w = props.world;
  const players = able(w);
  const [who, setWho] = useState(players[0]?.id ?? '');
  const player = players.find((m) => m.id === who) ?? players[0];
  if (!player) return null;
  if (playedTonight(w)) return <p class="hint">The common room has had its show tonight.</p>;
  return (
    <div class="perform" role="group" aria-label="Perform">
      <label>
        Performer{' '}
        <select value={player.id} onChange={(e) => setWho((e.target as HTMLSelectElement).value)}>
          {players.map((m) => (
            <option key={m.id} value={m.id}>
              {m.character.name} (Perform {m.character.skills.perform ?? '-'})
            </option>
          ))}
        </select>
      </label>{' '}
      <button type="button" onClick={() => props.act(() => playForLodging(w, data, player.id))}>
        Play for the party's lodging
      </button>
    </div>
  );
}

/** A prayer at a temple or mortuary: ease one's own strain or lift someone's Frailty. */
export function PrayerForm(props: { world: World; act: Act }) {
  const w = props.world;
  const ready = able(w).filter((m) => !prayedToday(w, m));
  const frail = w.members.filter((m) => !m.dead && m.frail);
  const [who, setWho] = useState(ready[0]?.id ?? '');
  const [chosen, setPurpose] = useState('strain');
  // Once the chosen member's Frailty is gone, the prayer goes back to easing strain.
  const purpose = frail.some((m) => m.id === chosen) ? chosen : 'strain';
  const prayer = ready.find((m) => m.id === who) ?? ready[0];
  if (!prayer) return <p class="hint">Everyone has prayed today.</p>;
  const asked: Prayer =
    purpose === 'strain' ? { kind: 'strain' } : { kind: 'frailty', target: purpose };
  return (
    <div class="prayer" role="group" aria-label="Pray">
      <label>
        Who prays{' '}
        <select value={prayer.id} onChange={(e) => setWho((e.target as HTMLSelectElement).value)}>
          {ready.map((m) => (
            <option key={m.id} value={m.id}>
              {m.character.name} (Pray {m.character.skills.pray ?? '-'})
            </option>
          ))}
        </select>
      </label>{' '}
      <label>
        For{' '}
        <select value={purpose} onChange={(e) => setPurpose((e.target as HTMLSelectElement).value)}>
          <option value="strain">Ease their own strain</option>
          {frail.map((m) => (
            <option key={m.id} value={m.id}>
              Lift {m.character.name}'s Frailty
            </option>
          ))}
        </select>
      </label>{' '}
      <button type="button" onClick={() => props.act(() => pray(w, data, prayer.id, asked))}>
        Pray
      </button>
    </div>
  );
}
