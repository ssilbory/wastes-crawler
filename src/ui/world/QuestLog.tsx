import { useState } from 'preact/hooks';
import { abandonQuest } from '../../game/world/quest-board.ts';
import { questOf } from '../../game/world/quests.ts';
import type { World } from '../../game/world/types.ts';
import { questStatus, questTarget } from '../../render/quest-view.ts';
import { setDestination } from '../../game/world/plans.ts';
import { hexKey } from '../../rules/hex.ts';
import { data } from '../builder/data.ts';
import { ConfirmButton } from '../confirm.tsx';

/** The quests under way or ready to hand in, by id. */
export const openQuests = (w: World) =>
  Object.entries(w.quests).filter(([, st]) => st.status === 'active' || st.status === 'ready');

/**
 * Quests under way, with their current steps. With none it shows nothing, so it takes no room;
 * the quarter's plan says where to find one instead (QuarterPanel.tsx).
 */
export function QuestLog(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const open = openQuests(w);
  if (open.length === 0) return null;
  // Only on the hex map, with nothing to settle first.
  const steering = !w.dungeon && !w.encounter && !w.coach;
  const course = (id: string) => {
    const to = questTarget(w, data, id);
    return steering && to && hexKey(to) !== hexKey(w.position) ? to : null;
  };
  return (
    <section class="panel" aria-label="Quests">
      <h3>Quests</h3>
      <ul class="quest-list">
        {open.map(([id]) => (
          <li key={id}>
            <strong>{questOf(data, id).name}</strong>
            <span>{questStatus(w, data, id)}</span>
            {course(id) && (
              <button
                type="button"
                class="secondary"
                aria-label={`Set course for ${questOf(data, id).name}`}
                onClick={() => {
                  const ok = setDestination(w, data, course(id));
                  setMessage(ok ? null : 'No known way leads there yet.');
                  props.onChange();
                }}
              >
                Set course
              </button>
            )}
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
