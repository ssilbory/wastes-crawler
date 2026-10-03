import {
  acceptQuest,
  cannotAccept,
  giversHere,
  questsFrom,
  turnInQuest,
} from '../../game/world/quest-board.ts';
import type { World } from '../../game/world/types.ts';
import { questStatus, rewardText } from '../../render/quest-view.ts';
import { data } from '../builder/data.ts';
import type { Act } from './TownScreen.tsx';

/** The town's mission givers and their quests (docs/rules-adaptation.md, Quests). */
export function QuestsTab(props: { world: World; act: Act }) {
  const w = props.world;
  const givers = giversHere(w, data);
  return (
    <>
      {givers.length === 0 && <p class="hint">No one here has work for the party.</p>}
      {givers.map((g) => (
        <section key={g.id} class="panel" aria-label={g.name}>
          <h2>{g.name}</h2>
          <p class="hint">{g.text}</p>
          <ul class="quest-list">
            {questsFrom(data, g.id).map((q) => {
              const st = w.quests[q.id];
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
                  {st?.status === 'ready' && (
                    <button
                      type="button"
                      onClick={() => props.act(() => turnInQuest(w, data, q.id))}
                    >
                      Collect the reward
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
