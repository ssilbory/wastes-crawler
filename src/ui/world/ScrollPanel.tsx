import { useState } from 'preact/hooks';
import { heldSpell } from '../../game/character/spell-items.ts';
import { outsideScrolls, unrollScroll } from '../../game/world/scroll-reading.ts';
import type { World } from '../../game/world/types.ts';
import { data } from '../builder/data.ts';

/**
 * Scrolls of spells cast outside fights (docs/rules-adaptation.md, Scrolls outside fights): read
 * one, and the spell waits in its own panel for the reader to cast it this quarter.
 */
export function ScrollPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  if (w.encounter) return null;
  const able = w.members.filter((m) => !m.dead && m.character.hp.current > 0);
  const held = able.filter((m) => m.unrolled);
  const scrolls = able.flatMap((m) => outsideScrolls(data, m).map((s) => ({ m, ...s })));
  if (held.length === 0 && scrolls.length === 0) return null;
  return (
    <section class="panel" aria-label="Scrolls">
      <h3>Scrolls</h3>
      {held.map((m) => (
        <p key={m.id} class="hint">
          {m.character.name} holds {heldSpell(data, (m.unrolled as { spell: string }).spell).name},
          read from a scroll, until the quarter ends.
        </p>
      ))}
      <div class="actions">
        {scrolls.map(({ m, item, spell }) => (
          <button
            key={`${m.id}/${item}`}
            type="button"
            onClick={() => {
              const r = unrollScroll(w, data, m.id, item);
              setMessage(r.ok ? null : r.reason);
              props.onChange();
            }}
          >
            {m.character.name}: read the scroll of {heldSpell(data, spell).name}
          </button>
        ))}
      </div>
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
