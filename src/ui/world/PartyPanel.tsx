import type { Member } from '../../game/world/types.ts';
import { characterSheet } from '../../game/character/derived.ts';
import { levelLine } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';

function tags(m: Member): string[] {
  if (m.dead) return ['dead'];
  return [
    m.hungry && 'Hungry',
    m.sleepless && 'Sleepless',
    m.cold && 'Cold',
    m.frail && 'Frail',
    m.character.strain.broken && 'Broken',
    m.slept && 'slept today',
  ].filter((t): t is string => typeof t === 'string');
}

export function PartyPanel(props: { members: Member[] }) {
  return (
    <section class="panel party-panel" aria-label="Party">
      <h2>Party</h2>
      <ul>
        {props.members.map((m) => {
          const c = m.character;
          const max = characterSheet(c, data).strainMax;
          return (
            <li key={m.id} class={m.dead ? 'gone' : undefined}>
              <strong>{c.name}</strong>
              <span class="hp-bar" aria-hidden="true">
                <span style={{ width: `${Math.round((c.hp.current / c.hp.max) * 100)}%` }} />
              </span>
              <span class="slot-stats">
                HP {c.hp.current}/{c.hp.max} · Strain {c.strain.value}/{max}
              </span>
              <span class="slot-stats">{levelLine(data, c)}</span>
              {tags(m).length > 0 && (
                <span class="conditions">
                  {tags(m).map((t) => (
                    <span key={t} class="chip">
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
