import { useState } from 'preact/hooks';
import { raiseCorpse, raiseGraveKnight } from '../../game/world/necromancy.ts';
import type { TownResult } from '../../game/world/services.ts';
import type { World } from '../../game/world/types.ts';
import { deadOffer, type DeadOffer } from '../../render/dead-view.ts';
import { data } from '../builder/data.ts';
import { PopOut } from './PopOut.tsx';
import { SkullQuery } from './SkullQuery.tsx';

/** The corpses the party has answered about, by place, day, and how many lay there then. */
let answered: { at: string; day: number; corpses: number } | null = null;

/**
 * Whether to ask what becomes of the dead here (Sam's call): there are corpses, someone has the
 * means to question or raise them, and the party hasn't answered for them yet. More dead in the
 * same place ask again. The answer outlives the screen, so a visit to town doesn't ask twice.
 */
export function useDeadAsk(w: World): { offer: DeadOffer | null; dismiss: () => void } {
  const [, redraw] = useState(0);
  const c = w.corpses;
  const offer = c ? deadOffer(w, data) : null;
  const done =
    !!c &&
    !!offer &&
    answered?.at === c.at &&
    answered.day === c.day &&
    offer.corpses <= answered.corpses;
  return {
    offer: done ? null : offer,
    dismiss: () => {
      // Counted afresh: raising one leaves fewer.
      if (w.corpses)
        answered = { at: w.corpses.at, day: w.corpses.day, corpses: w.corpses.hitDice.length };
      redraw((n) => n + 1);
    },
  };
}

type Choice = 'query' | 'raise';

/**
 * The popup that asks, over the view, before the party moves on: question the dead or raise them,
 * one or the other. The Necromancy panel still has the rest.
 */
export function DeadPopOut(props: {
  world: World;
  ask: { offer: DeadOffer | null; dismiss: () => void };
  onChange: () => void;
}) {
  const w = props.world;
  const { offer, dismiss } = props.ask;
  const [picked, setPicked] = useState<Choice | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!offer) return null;
  const open: Choice[] = [
    ...(offer.query.length > 0 ? (['query'] as const) : []),
    ...(offer.raise.length > 0 ? (['raise'] as const) : []),
  ];
  // With one thing to do there is nothing to pick.
  const choice = picked && open.includes(picked) ? picked : open.length === 1 ? open[0] : null;
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    // Done is done: the popup closes on what was chosen.
    if (r.ok) dismiss();
    props.onChange();
  };
  return (
    <PopOut label="The dead" modal>
      <section class="panel" aria-label="The dead">
        <h3>The dead</h3>
        <p class="hint">
          {offer.corpses === 1 ? 'A corpse lies here.' : `${offer.corpses} corpses lie here.`} They
          can be put to use before the party moves on.
        </p>
        {open.length > 1 && (
          <div class="actions" role="radiogroup" aria-label="What becomes of the dead">
            <button
              type="button"
              role="radio"
              aria-checked={choice === 'query'}
              class={choice === 'query' ? undefined : 'secondary'}
              onClick={() => setPicked('query')}
            >
              Question the dead
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={choice === 'raise'}
              class={choice === 'raise' ? undefined : 'secondary'}
              onClick={() => setPicked('raise')}
            >
              Raise the dead
            </button>
          </div>
        )}
        {choice === 'query' &&
          offer.query.map((c) => (
            <div key={c.id} class="parley" role="group" aria-label={c.name}>
              <p>
                <strong>{c.name}</strong>: {c.left}
              </p>
              <SkullQuery world={w} caster={c} run={run} />
            </div>
          ))}
        {choice === 'raise' &&
          offer.raise.map(({ caster: c, corpse, knight }) => (
            <div key={c.id} class="parley" role="group" aria-label={c.name}>
              <p>
                <strong>{c.name}</strong>: {c.left}
              </p>
              {corpse && (
                <>
                  <button
                    type="button"
                    onClick={() => run(() => raiseCorpse(w, data, c.id, 'zombie'))}
                  >
                    Raise a zombie
                  </button>
                  <button
                    type="button"
                    onClick={() => run(() => raiseCorpse(w, data, c.id, 'skeleton'))}
                  >
                    Raise a skeleton
                  </button>
                </>
              )}
              {knight && (
                <button type="button" onClick={() => run(() => raiseGraveKnight(w, data, c.id))}>
                  Raise a Grave Knight
                </button>
              )}
            </div>
          ))}
        {message && <p class="bump">{message}</p>}
        <div class="actions">
          <button type="button" class="secondary" onClick={dismiss}>
            Not now
          </button>
        </div>
      </section>
    </PopOut>
  );
}
