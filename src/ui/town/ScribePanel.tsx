import { useState } from 'preact/hooks';
import {
  canScribe,
  scribeDifficulty,
  scribesOf,
  scrollCost,
  scrollParts,
  writingKitName,
  startScroll,
} from '../../game/world/scribing.ts';
import { partsText } from '../../game/world/components.ts';
import type { World } from '../../game/world/types.ts';
import { daysText } from '../../game/world/wording.ts';
import { crowns } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';
import { priceHere } from '../../game/world/town-prices.ts';

/** Writing scrolls (docs/rules-adaptation.md, Potions, scrolls, and magic devices: Scrolls). */
export function ScribePanel(props: { world: World; act: Act }) {
  const w = props.world;
  const scribes = w.members.filter((m) => !m.dead && canScribe(data, m));
  const [who, setWho] = useState(scribes[0]?.id ?? '');
  const [spell, setSpell] = useState('');
  const m = scribes.find((x) => x.id === who) ?? scribes[0];
  const spells = m ? scribesOf(data, m) : [];
  const s = spells.find((x) => x.id === spell) ?? spells[0];
  return (
    <section class="panel" aria-label="Scribe">
      <h2>Scribe</h2>
      {!m ? (
        <p class="hint">No one in the party has the Scribing skill.</p>
      ) : (
        <>
          <label>
            Scribe{' '}
            <select value={m.id} onChange={(e) => setWho((e.target as HTMLSelectElement).value)}>
              {scribes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.character.name}
                </option>
              ))}
            </select>
          </label>{' '}
          {!s ? (
            <p class="hint">{m.character.name} knows no spell that fits on a scroll.</p>
          ) : (
            <>
              <label>
                Spell{' '}
                <select
                  value={s.id}
                  onChange={(e) => setSpell((e.target as HTMLSelectElement).value)}
                >
                  {spells.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} (level {x.level})
                    </option>
                  ))}
                </select>
              </label>
              <p class="hint">
                Int/Scribing against {scribeDifficulty(data, s.id)}, +1 with another scribe in the
                party; a failed scroll is lost. Takes a {writingKitName(data)} and{' '}
                {partsText(scrollParts(data, s.id))}.
              </p>
              <button
                type="button"
                onClick={() => props.act(() => startScroll(w, data, m.id, s.id))}
              >
                Start ({crowns(priceHere(w, data, scrollCost(data, s.id)))},{' '}
                {daysText(data.content.scrolls.days)})
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
