import {
  acceptQuest,
  cannotAccept,
  giversHere,
  questBoard,
  standing,
  turnInQuest,
} from '../../game/world/quest-board.ts';
import { decideSeal, type SealChoice } from '../../game/world/seal.ts';
import type { World } from '../../game/world/types.ts';
import { sealOpen } from '../../render/setting-view.ts';
import { questStatus, rewardText } from '../../render/quest-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';
import { townHere } from '../../game/world/town-prices.ts';

const SEAL: [SealChoice, string][] = [
  ['destroy', 'Destroy the seal'],
  ['give', 'Give it to the council'],
  ['keep', 'Keep it'],
];

/** The town's mission givers and their quests (docs/rules-adaptation.md, Quests). */
export function QuestsTab(props: { world: World; act: Act }) {
  const w = props.world;
  const givers = giversHere(w, data);
  const town = townHere(w, data);
  return (
    <>
      {givers.length === 0 && <p class="hint">No one here has work for the party.</p>}
      {givers.map((g) => (
        <section key={g.id} class="panel" aria-label={g.name}>
          <h2>{g.name}</h2>
          <p class="hint">{g.text}</p>
          <ul class="quest-list">
            {questBoard(w, data, g.id).map((q) => {
              const st = standing(w, q);
              const blocked = cannotAccept(w, data, q);
              return (
                <li key={q.id}>
                  <strong>{q.name}</strong>
                  <span>{q.summary}</span>
                  <span class="hint">
                    Reward: {rewardText(q)}
                    {q.deadlineDays !== undefined && ` · ${q.deadlineDays} days to finish`}
                  </span>
                  {st ? (
                    <span>{questStatus(w, data, q.id)}</span>
                  ) : (
                    blocked && <span class="hint">{blocked}</span>
                  )}
                  {!st && !blocked && (
                    <button
                      type="button"
                      onClick={() => props.act(() => acceptQuest(w, data, q.id))}
                    >
                      Take on {q.name}
                    </button>
                  )}
                  {st?.status === 'ready' && !q.reward.raise && (
                    <button
                      type="button"
                      onClick={() => props.act(() => turnInQuest(w, data, q.id))}
                    >
                      Collect the reward
                    </button>
                  )}
                  {st?.status === 'ready' &&
                    q.reward.raise &&
                    w.members
                      .filter((m) => m.dead)
                      .map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => props.act(() => turnInQuest(w, data, q.id, m.id))}
                        >
                          Raise {m.character.name}
                        </button>
                      ))}
                </li>
              );
            })}
          </ul>
          {sealOpen(w, data, g.id, town.id) && (
            <div class="parley" role="group" aria-label="The Seal of Command">
              <p>
                The warlord is dead, and the party holds the Seal of Command. What becomes of it?
              </p>
              {SEAL.map(([choice, label]) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => props.act(() => decideSeal(w, data, town.id, choice))}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  );
}
