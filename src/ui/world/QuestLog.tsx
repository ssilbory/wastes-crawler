import { useState } from 'preact/hooks';
import { abandonQuest } from '../../game/world/quest-board.ts';
import { questOf } from '../../game/world/quests.ts';
import type { World } from '../../game/world/types.ts';
import { captiveEscorts, questStatus, questTarget } from '../../render/quest-view.ts';
import type { Hex } from '../../rules/hex.ts';
import { setDestination } from '../../game/world/plans.ts';
import { hexKey } from '../../rules/hex.ts';
import { data } from '../builder/data.ts';
import { ConfirmButton } from '../confirm.tsx';

/** The quests under way or ready to hand in, by id. */
export const openQuests = (w: World) =>
  Object.entries(w.quests).filter(([, st]) => st.status === 'active' || st.status === 'ready');

/**
 * Quests under way, with their current steps, and freed captives being taken home (Sam's call).
 * With neither it shows nothing, so it takes no room; the quarter's plan says where to find a
 * quest instead (QuarterPanel.tsx).
 */
export function QuestLog(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const open = openQuests(w);
  const escorts = captiveEscorts(w, data);
  if (open.length === 0 && escorts.length === 0) return null;
  // Only on the hex map, with nothing to settle first.
  const steering = !w.dungeon && !w.encounter && !w.coach;
  const towards = (to: Hex | null) =>
    steering && to && hexKey(to) !== hexKey(w.position) ? to : null;
  const course = (id: string) => towards(questTarget(w, data, id));
  const steer = (to: Hex | null, name: string) =>
    to && (
      <button
        type="button"
        class="secondary"
        aria-label={`Set course for ${name}`}
        onClick={() => {
          const ok = setDestination(w, data, to);
          setMessage(ok ? null : 'No known way leads there yet.');
          props.onChange();
        }}
      >
        Set course
      </button>
    );
  return (
    <section class="panel" aria-label="Quests">
      <h3>Quests</h3>
      <ul class="quest-list">
        {open.map(([id]) => (
          <li key={id}>
            <strong>{questOf(data, id).name}</strong>
            <span>{questStatus(w, data, id)}</span>
            {steer(course(id), questOf(data, id).name)}
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
        {escorts.map((e) => (
          <li key={e.id}>
            <strong>{e.name}</strong>
            <span>{e.status}</span>
            {steer(towards(e.target), e.name)}
          </li>
        ))}
      </ul>
      {message && <p class="hint">{message}</p>}
    </section>
  );
}
