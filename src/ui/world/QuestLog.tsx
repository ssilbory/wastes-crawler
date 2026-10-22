import { useState } from 'preact/hooks';
import { abandonQuest } from '../../game/world/quest-board.ts';
import { questOf } from '../../game/world/quests.ts';
import type { World } from '../../game/world/types.ts';
import { questStatus } from '../../render/quest-view.ts';
import { data } from '../builder/data.ts';
import { ConfirmButton } from '../confirm.tsx';

/** Quests under way, with their current steps. */
export function QuestLog(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const open = Object.entries(w.quests).filter(
    ([, st]) => st.status === 'active' || st.status === 'ready',
  );
  if (open.length === 0) return null;
  return (
    <section class="panel" aria-label="Quests">
      <h3>Quests</h3>
      <ul class="quest-list">
        {open.map(([id]) => (
          <li key={id}>
            <strong>{questOf(data, id).name}</strong>
            <span>{questStatus(w, data, id)}</span>
            <ConfirmButton
              class="secondary"
              label={`Abandon ${questOf(data, id).name}`}
              confirm="Abandon for good"
              onConfirm={() => {
                const r = abandonQuest(w, data, id);
                setMessage(r.ok ? null : r.reason);
                props.onChange();
              }}
            >
              Abandon
            </ConfirmButton>
          </li>
        ))}
      </ul>
      {message && <p class="hint">{message}</p>}
    </section>
  );
}
