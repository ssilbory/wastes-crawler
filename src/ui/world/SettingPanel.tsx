import type { World } from '../../game/world/types.ts';
import { settingNotes } from '../../render/setting-view.ts';
import { data } from '../builder/data.ts';

/** Raids threatened and suffered, countersigns learned, and tokens carried (Phase 12b). */
export function SettingPanel(props: { world: World }) {
  const lines = settingNotes(props.world, data);
  if (lines.length === 0) return null;
  return (
    <section class="panel" aria-label="Orders and raids">
      <h3>Orders and raids</h3>
      <ul class="setting-notes">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </section>
  );
}
