import type { Member } from '../../game/world/types.ts';
import { characterSheet } from '../../game/character/derived.ts';
import { levelLine } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import { findDisease } from '../../game/world/ailing.ts';
import { hpLevel } from '../../render/hp-level.ts';
import type { Character } from '../../data/schemas/index.ts';

const percent = (c: Character) => Math.round((Math.max(0, c.hp.current) / c.hp.max) * 100);

function tags(m: Member): string[] {
  if (m.dead) return ['dead'];
  return [
    m.reviving && 'unconscious',
    m.hungry && 'Hungry',
    m.sleepless && 'Sleepless',
    m.cold && 'Cold',
    m.frail && 'Frail',
    m.poisoned && 'Poisoned',
    m.disease && findDisease(data, m.disease.id).name,
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
              <span class="member-head">
                <strong>{c.name}</strong>
                <span class="slot-stats">
                  HP {c.hp.current}/{c.hp.max} · Strain {c.strain.value}/{max}
                </span>
              </span>
              <span class={`hp-bar ${hpLevel(percent(c))}`} aria-hidden="true">
                <span style={{ width: `${percent(c)}%` }} />
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
