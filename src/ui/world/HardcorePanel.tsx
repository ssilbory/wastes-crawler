import { setHardcore } from '../../game/world/hardcore.ts';
import type { World } from '../../game/world/types.ts';
import { hardcoreView } from '../../render/hardcore-view.ts';

/** The hardcore options, each switched on or off at any time (docs/rules-adaptation.md). */
export function HardcorePanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  return (
    <section class="panel" aria-label="Hardcore">
      <h3>Hardcore</h3>
      <p class="hint">Harsher rules for this world. Switch any of them on or off at any time.</p>
      <ul class="hardcore-options">
        {hardcoreView(w).map((o) => (
          <li key={o.option}>
            <label>
              <input
                type="checkbox"
                checked={o.on}
                onChange={(e) => {
                  setHardcore(w, o.option, (e.target as HTMLInputElement).checked);
                  props.onChange();
                }}
              />{' '}
              <strong>{o.name}</strong>
            </label>
            <span class="hint">{o.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
