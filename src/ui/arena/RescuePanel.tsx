import {
  castRescue,
  dyingOf,
  finishMending,
  mendings,
  rescues,
  tendRound,
  woundedOf,
} from '../../game/combat/aftermath.ts';
import type { Battle } from '../../game/combat/types.ts';
import { MORTAL_ROUNDS } from '../../rules/combat.ts';

/**
 * After a won fight, while healing magic could still save the dying: use it, or let the party keep
 * making Heal checks for another round (docs/rules-adaptation.md, Combat engine).
 */
export function RescuePanel(props: { battle: Battle; onTend: (step: () => void) => void }) {
  const b = props.battle;
  if (dyingOf(b).length === 0) return <MendPanel battle={b} onTend={props.onTend} />;
  const left = (fellRound: number) => MORTAL_ROUNDS - (b.round - fellRound);
  return (
    <section class="panel rescue" aria-label="Tend the dying">
      <h3>Tend the dying</h3>
      <ul>
        {dyingOf(b).map((c) => (
          <li key={c.id}>
            {c.name} is dying: {left(c.fellRound)} round{left(c.fellRound) === 1 ? '' : 's'} left.
          </li>
        ))}
      </ul>
      <p class="hint">Use healing magic now, or keep trying Heal checks.</p>
      <div class="actions">
        {rescues(b).map((r) => (
          <button
            key={`${r.caster}-${r.magic}-${r.target}`}
            type="button"
            onClick={() => props.onTend(() => castRescue(b, r))}
          >
            {r.label}
          </button>
        ))}
        <button type="button" onClick={() => props.onTend(() => tendRound(b))}>
          Keep trying Heal checks
        </button>
      </div>
    </section>
  );
}

/** With no one dying, healing magic for the wounded, until the player is done (Sam's call). */
function MendPanel(props: { battle: Battle; onTend: (step: () => void) => void }) {
  const b = props.battle;
  return (
    <section class="panel rescue" aria-label="Heal the wounded">
      <h3>Heal the wounded</h3>
      <ul>
        {woundedOf(b).map((c) => (
          <li key={c.id}>
            {c.name}: {c.hp} of {c.maxHp} HP
          </li>
        ))}
      </ul>
      <div class="actions">
        {mendings(b).map((r) => (
          <button
            key={`${r.caster}-${r.magic}-${r.target}`}
            type="button"
            onClick={() => props.onTend(() => castRescue(b, r))}
          >
            {r.label}
          </button>
        ))}
        <button type="button" onClick={() => props.onTend(() => finishMending(b))}>
          Done healing
        </button>
      </div>
    </section>
  );
}
