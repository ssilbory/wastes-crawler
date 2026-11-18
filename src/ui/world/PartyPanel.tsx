import type { Member } from '../../game/world/types.ts';
import { characterSheet } from '../../game/character/derived.ts';
import { levelLine } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import { findDisease } from '../../game/world/ailing.ts';
import { hpLevel } from '../../render/hp-level.ts';
import type { Character } from '../../data/schemas/index.ts';

const percent = (c: Character) => Math.round((Math.max(0, c.hp.current) / c.hp.max) * 100);

function tags(m: Member): string[] {
  // Dead and Frail are in the card's first line, not chips under it.
  if (m.dead) return [];
  return [
    m.reviving && 'unconscious',
    m.hungry && 'Hungry',
    m.sleepless && 'Sleepless',
    m.cold && 'Cold',
    m.poisoned && 'Poisoned',
    m.disease && findDisease(data, m.disease.id).name,
    m.character.strain.broken && 'Broken',
    m.slept && 'slept today',
  ].filter((t): t is string => typeof t === 'string');
}

/**
 * Each member's health, strain, and conditions, kept to one line where it can be (Sam's call):
 * strain reads Str, Frail is a big F beside it, and Dead stands in for the numbers. As a `strip` it runs across the status bar, one
 * small card a member, so it stays on screen while the rest scrolls (party-strip.css); the level
 * line moves into each card's hover text there.
 */
export function PartyPanel(props: { members: Member[]; strip?: boolean }) {
  const strip = props.strip === true;
  return (
    <section class={strip ? 'party-panel party-strip' : 'panel party-panel'} aria-label="Party">
      <h2 class={strip ? 'sr-only' : undefined}>Party</h2>
      <ul>
        {props.members.map((m) => {
          const c = m.character;
          const max = characterSheet(c, data).strainMax;
          return (
            <li
              key={m.id}
              class={m.dead ? 'gone' : undefined}
              title={strip ? levelLine(data, c) : undefined}
            >
              <span class="member-head">
                <strong>{c.name}</strong>
                <span class="slot-stats">
                  {m.dead ? (
                    'Dead'
                  ) : (
                    <>
                      HP {c.hp.current}/{c.hp.max} · <abbr title="System Strain">Str</abbr>{' '}
                      {c.strain.value}/{max}
                      {m.frail && (
                        <b class="frail-mark" title="Frail">
                          <span aria-hidden="true">F</span>
                          <span class="sr-only">Frail</span>
                        </b>
                      )}
                    </>
                  )}
                </span>
              </span>
              <span class={`hp-bar ${hpLevel(percent(c))}`} aria-hidden="true">
                <span style={{ width: `${percent(c)}%` }} />
              </span>
              {!strip && <span class="slot-stats">{levelLine(data, c)}</span>}
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
