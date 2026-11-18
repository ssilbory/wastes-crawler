import { useState } from 'preact/hooks';
import { makeRoomForFreed } from '../../game/world/hire.ts';
import { npcRoom } from '../../game/world/npcs.ts';
import { freedWaiting, partWithFreed, takeFreed } from '../../game/world/rescue.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { townName } from '../../render/quest-view.ts';
import { data } from '../builder/data.ts';
import { ConfirmButton } from '../confirm.tsx';
import { parting, role } from './NpcPanel.tsx';
import { PopOut } from './PopOut.tsx';

/** Whether a freed captive waits on room in the party, once the encounter is over. */
export const freedOpen = (w: World): boolean => !w.encounter && w.freedCaptive !== null;

/**
 * A captive freed with the NPC slots full (docs/rules-adaptation.md, NPCs in Phase 6c: Rescues):
 * dismiss an NPC to take them along, or let them go their own way.
 */
export function FreedPopOut(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const c = freedWaiting(w, data);
  if (!c) return null;
  const name = c.name.charAt(0).toUpperCase() + c.name.slice(1);
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <PopOut label="A freed captive" modal>
      <section class="panel" aria-label="A freed captive">
        <h3>{name} is free</h3>
        <p>
          {name} would travel with the party to {townName(data, c.destination)}, but it has no room
          for another NPC.
        </p>
        {npcRoom(w, false) ? (
          <div class="actions">
            <button type="button" onClick={() => run(() => takeFreed(w, data))}>
              Take them along
            </button>
          </div>
        ) : (
          <ul class="tavern-list">
            {w.npcs.map((n) => (
              <li key={n.id}>
                <span>
                  <strong>{n.name}</strong> {role(w, n)}
                </span>
                <ConfirmButton
                  label={`${parting(n)} ${n.name} to make room`}
                  confirm={`${parting(n)} for good`}
                  onConfirm={() => run(() => makeRoomForFreed(w, data, n.id))}
                >
                  {parting(n)} to make room
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
        <div class="actions">
          <button
            type="button"
            class="secondary"
            onClick={() => {
              partWithFreed(w, data);
              props.onChange();
            }}
          >
            Let them go their own way
          </button>
        </div>
        {message && <p class="hint">{message}</p>}
      </section>
    </PopOut>
  );
}
