import { chooseSide } from '../../game/world/siege-sides.ts';
import type { World } from '../../game/world/types.ts';
import { sideChoices } from '../../render/siege-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

/** A side to take in each rivals' siege of the town (Phase 23d), or to keep out of it. */
export function SidePanel(props: { world: World; act: Act }) {
  const w = props.world;
  const choices = sideChoices(w, data);
  if (choices.length === 0 || w.encounter) return null;
  return (
    <section class="panel" aria-label="Take a side">
      {choices.map((c) => (
        <div key={c.attacker}>
          <p class="hint">
            {c.besiegers} besieges the town, held by {c.holder}. Fight for one side, and its next
            assault comes tonight, or keep out of it.
          </p>
          <button
            type="button"
            onClick={() => props.act(() => chooseSide(w, data, c.attacker, 'attacker'))}
          >
            Fight for {c.besiegers}
          </button>
          <button
            type="button"
            onClick={() => props.act(() => chooseSide(w, data, c.attacker, 'defender'))}
          >
            Fight for {c.holder}
          </button>
          <button
            type="button"
            class="secondary"
            onClick={() => props.act(() => chooseSide(w, data, c.attacker, 'out'))}
          >
            Keep out of it
          </button>
        </div>
      ))}
    </section>
  );
}
