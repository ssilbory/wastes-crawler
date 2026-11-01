import { useState } from 'preact/hooks';
import { handlers } from '../../game/world/beasts.ts';
import { monsterOf } from '../../game/world/npcs.ts';
import type { TownResult } from '../../game/world/services.ts';
import {
  hirelingFor,
  killSurrendered,
  questionSurrendered,
  recruitable,
  recruitSurrendered,
  releaseSurrendered,
  surrenderedHere,
  surrenderQuestions,
} from '../../game/world/surrender.ts';
import type { SkullQuestion } from '../../game/world/skull.ts';
import { cannotEnthrall, enthrall } from '../../game/world/thralls.ts';
import type { World } from '../../game/world/types.ts';
import { data } from '../builder/data.ts';
import { PopOut } from './PopOut.tsx';

const ASK: Record<SkullQuestion, string> = {
  boss: "Where is this level's boss?",
  vault: 'Where is the vault?',
  hoard: 'Where are the hoards?',
  land: 'What lies about?',
  map: '',
  traps: '',
  secrets: '',
};

/** Whether the surrendered of the last fight wait on the party here (Phase 19). */
export const surrenderOpen = (w: World): boolean => !w.encounter && surrenderedHere(w).length > 0;

/**
 * Foes who surrendered (docs/rules-adaptation.md, Morale, escape, and surrender): question them
 * once, take one on, then let the rest go or kill them, which closes it.
 */
export function SurrenderPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const [message, setMessage] = useState<string | null>(null);
  const s = w.surrendered;
  const foes = surrenderedHere(w);
  if (!s || foes.length === 0 || w.encounter) return null;
  const keepers = handlers(w, data);
  const run = (action: () => TownResult) => {
    const r = action();
    setMessage(r.ok ? null : r.reason);
    props.onChange();
  };
  const joinLabel = (monster: string) => {
    const t = hirelingFor(data, monster);
    return t ? `as a ${t.name}` : '';
  };
  return (
    <section class="panel" aria-label="The surrendered">
      <h3>The surrendered</h3>
      <p>{foes.map((id) => monsterOf(data, id).name).join(', ')} throw down their arms.</p>
      {!s.questioned && (
        <div class="actions" role="group" aria-label="Question them">
          {surrenderQuestions(w).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => run(() => questionSurrendered(w, data, q))}
            >
              {ASK[q]}
            </button>
          ))}
        </div>
      )}
      {!s.recruited && (
        <div class="actions" role="group" aria-label="Take one on">
          {foes.map((id, i) => {
            const kind = recruitable(data, id);
            const name = monsterOf(data, id).name;
            if (kind === 'hireling')
              return (
                <button
                  key={`${id}-${i}`}
                  type="button"
                  onClick={() => run(() => recruitSurrendered(w, data, i, null))}
                >
                  Take on the {name} {joinLabel(id)}
                </button>
              );
            if (kind !== 'beast') return null;
            return keepers.map((m) => (
              <button
                key={`${id}-${i}-${m.id}`}
                type="button"
                onClick={() => run(() => recruitSurrendered(w, data, i, m.id))}
              >
                The {name} follows {m.character.name}
              </button>
            ));
          })}
        </div>
      )}
      {/* Obnubilation of the Will, for each caster who could cast it on each prisoner (Phase 21). */}
      <div class="actions" role="group" aria-label="Enthrall">
        {w.members.flatMap((m) =>
          foes.flatMap((id, i) =>
            cannotEnthrall(w, data, m.id, i)
              ? []
              : [
                  <button
                    key={`${m.id}-${id}-${i}`}
                    type="button"
                    onClick={() => run(() => enthrall(w, data, m.id, i))}
                  >
                    {m.character.name}: enthrall the {monsterOf(data, id).name}
                  </button>,
                ],
          ),
        )}
      </div>
      <div class="actions">
        <button type="button" onClick={() => run(() => releaseSurrendered(w, data))}>
          Let them go
        </button>
        <button type="button" class="secondary" onClick={() => run(() => killSurrendered(w, data))}>
          Kill them
        </button>
      </div>
      {message && <p class="bump">{message}</p>}
    </section>
  );
}

/** The popup over the view, until the party lets the surrendered go or kills them. */
export function SurrenderPopOut(props: { world: World; onChange: () => void }) {
  return (
    <PopOut label="The surrendered" modal>
      <SurrenderPanel world={props.world} onChange={props.onChange} />
    </PopOut>
  );
}
