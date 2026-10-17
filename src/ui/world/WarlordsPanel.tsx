import type { World } from '../../game/world/types.ts';
import { warlordViews } from '../../render/warlord-view.ts';
import { data } from '../builder/data.ts';

/** The Wastes' warlords, map by map, and who has fallen (docs/setting.md, The warlords). */
export function WarlordsPanel(props: { world: World }) {
  const views = warlordViews(props.world, data);
  if (views.length === 0) return null;
  return (
    <section class="panel" aria-label="Warlords">
      <h3>Warlords</h3>
      <ul class="setting-notes">
        {views.map((v) => (
          <li key={v.id} class={v.fallen ? 'gone' : undefined}>
            <strong>{v.name}</strong>, {v.map}: {v.fallen ? 'fallen' : `holds ${v.stronghold}`}
          </li>
        ))}
      </ul>
    </section>
  );
}
