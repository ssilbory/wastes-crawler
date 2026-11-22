import { useState } from 'preact/hooks';
import { drink, pourDraught } from '../../game/world/potions.ts';
import type { Member, World } from '../../game/world/types.ts';
import { potionView, usable } from '../../render/potion-view.ts';
import { data } from '../builder/data.ts';
import { TabulaRasaDialog } from './TabulaRasaDialog.tsx';

/** Potions out of combat: drink one or give it to another member (docs/rules-adaptation.md). */
export function PotionPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  /** Tabula Rasa waits on the target's new picks before it is drunk. */
  const [slate, setSlate] = useState<{ holder: Member; target: Member; potion: string } | null>(
    null,
  );
  if (w.encounter) return null;
  const lines = usable(potionView(w, data));
  if (lines.length === 0) return null;
  return (
    <section class="panel" aria-label="Potions">
      <h3>Potions</h3>
      {lines.map((l) => (
        <div
          key={`${l.holder.id}/${l.potion.id}`}
          class="parley"
          role="group"
          aria-label={l.potion.name}
        >
          <p>
            <strong>{l.holder.name}</strong>: {l.potion.name} ({l.count})
          </p>
          <p class="hint">{l.potion.text}</p>
          {l.potion.raises &&
            (['zombie', 'skeleton'] as const).map((form) => (
              <button
                key={form}
                type="button"
                onClick={() => {
                  const r = pourDraught(w, data, l.holder.id, l.potion.id, form);
                  setMessage(r.ok ? null : r.reason);
                  props.onChange();
                }}
              >
                Raise a {form}
              </button>
            ))}
          {!l.potion.raises &&
            l.targets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (l.potion.anew) {
                    const holder = w.members.find((m) => m.id === l.holder.id);
                    const target = w.members.find((m) => m.id === t.id);
                    if (holder && target) setSlate({ holder, target, potion: l.potion.id });
                    return;
                  }
                  const r = drink(w, data, l.holder.id, l.potion.id, t.id);
                  setMessage(r.ok ? null : r.reason);
                  props.onChange();
                }}
              >
                {t.id === l.holder.id ? 'Drink' : `Give ${t.name}`}
              </button>
            ))}
        </div>
      ))}
      {message && <p class="bump">{message}</p>}
      {slate && (
        <TabulaRasaDialog
          world={w}
          holder={slate.holder}
          target={slate.target}
          potion={slate.potion}
          onClose={() => setSlate(null)}
          onDone={(m) => {
            setSlate(null);
            setMessage(m);
            props.onChange();
          }}
        />
      )}
    </section>
  );
}
