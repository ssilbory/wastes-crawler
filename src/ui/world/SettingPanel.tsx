import { burnNotes, keepNotes, sellNotes } from '../../game/world/notes.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { notesChoices, settingNotes } from '../../render/setting-view.ts';
import { data } from '../builder/data.ts';

/**
 * Raids threatened and suffered, countersigns learned, tokens carried (Phase 12b), and the
 * warlord's clock, crafter's notes awaiting a decision, and the ending (Phase 12d).
 */
export function SettingPanel(props: { world: World; inTown: boolean; onChange: () => void }) {
  const w = props.world;
  const lines = settingNotes(w, data);
  const notes = notesChoices(w, data, props.inTown);
  if (lines.length === 0 && notes.length === 0) return null;
  const run = (action: () => TownResult) => {
    action();
    props.onChange();
  };
  return (
    <section class="panel" aria-label="Orders and raids">
      <h3>Orders and raids</h3>
      <ul class="setting-notes">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {notes.map((n) => (
        <div key={n.id} class="parley" role="group" aria-label={n.name}>
          <p class="hint">The party carries {n.name}.</p>
          <button type="button" onClick={() => run(() => burnNotes(w, data, n.id))}>
            Burn them
          </button>
          {n.canSell && (
            <button type="button" onClick={() => run(() => sellNotes(w, data, n.id))}>
              Sell to a warlord's agent
            </button>
          )}
          <button type="button" onClick={() => run(() => keepNotes(w, data, n.id))}>
            Keep them
          </button>
        </div>
      ))}
    </section>
  );
}
