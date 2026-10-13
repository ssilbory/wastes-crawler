import type { TurnView } from '../../render/fight-fx.ts';

/** The turns left this round, in order, each marked by its side (docs/presentation-plan.md, V3). */
export function TurnStrip(props: { turns: TurnView[]; round: number }) {
  return (
    <ol class="turn-strip" aria-label={`Turn order, round ${props.round}`}>
      {props.turns.map((t) => (
        <li
          key={t.id}
          class={`turn ${t.side}${t.now ? ' now' : ''}`}
          aria-current={t.now ? 'step' : undefined}
        >
          {t.label}
        </li>
      ))}
      <li class="turn next-round">Round {props.round + 1}</li>
    </ol>
  );
}
