import { useEffect, useState } from 'preact/hooks';
import type { Element } from '../../data/schemas/index.ts';
import { ELEMENTS, makePact, PACT, pactOf } from '../../game/world/pacts.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { castersOf } from '../../game/world/waygates.ts';
import { data } from '../builder/data.ts';

/** Pact of Stone and Sea on a living member, and the pacts in force. */
export function PactPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const living = w.members.filter((m) => !m.dead);
  const [target, setTarget] = useState(living[0]?.id ?? '');
  const [element, setElement] = useState<Element>('fire');
  const [message, setMessage] = useState<string | null>(null);
  const casters = castersOf(w, PACT);
  const pacted = living.flatMap((m) => {
    const p = pactOf(w, m.id);
    return p ? [`${m.character.name}: ${p}`] : [];
  });
  useEffect(() => setMessage(null), [w.day]);
  if ((casters.length === 0 || w.encounter) && pacted.length === 0) return null;
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <section class="panel" aria-label="Pact of Stone and Sea">
      <h3>Pact of Stone and Sea</h3>
      {pacted.length > 0 && <p class="hint">Pacted: {pacted.join(', ')}.</p>}
      {!w.encounter && casters.length > 0 && (
        <>
          <label>
            Pact{' '}
            <select value={target} onChange={(e) => setTarget(e.currentTarget.value)}>
              {living.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.character.name}
                </option>
              ))}
            </select>
          </label>{' '}
          <label>
            with{' '}
            <select value={element} onChange={(e) => setElement(e.currentTarget.value as Element)}>
              {ELEMENTS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          {casters.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => run(() => makePact(w, data, m.id, target, element))}
            >
              {m.character.name}: seal the pact
            </button>
          ))}
        </>
      )}
      {message && <p class="bump">{message}</p>}
    </section>
  );
}
