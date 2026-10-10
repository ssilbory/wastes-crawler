import { useState } from 'preact/hooks';
import { campUnderground } from '../../game/dungeon/time.ts';
import type { World } from '../../game/world/types.ts';
import { data } from '../builder/data.ts';

type Job = 'sleep' | 'rest' | 'watch';
const JOBS: Record<Job, string> = { sleep: 'Sleep', rest: 'Rest', watch: 'Keep watch' };

/** A quarter camped on a safe square underground (docs/rules-adaptation.md, Dungeon exploration). */
export function CampPanel(props: { world: World; onChange: () => void }) {
  const w = props.world;
  const able = w.members.filter((m) => !m.dead && m.character.hp.current > 0);
  // The first conscious PC keeps watch and the rest sleep, unless changed.
  const [jobs, setJobs] = useState<Record<string, Job>>(() =>
    Object.fromEntries(able.map((m, i) => [m.id, i === 0 ? 'watch' : 'sleep'])),
  );
  return (
    <section class="panel" aria-label="Camp">
      <h3>Camp</h3>
      <p>A safe place to rest. Camping takes a quarter day.</p>
      <div class="roles">
        {able.map((m) => (
          <label key={m.id}>
            {m.character.name}{' '}
            <select
              value={jobs[m.id] ?? 'sleep'}
              onChange={(e) =>
                setJobs({ ...jobs, [m.id]: (e.target as HTMLSelectElement).value as Job })
              }
            >
              {(Object.keys(JOBS) as Job[]).map((j) => (
                <option key={j} value={j}>
                  {JOBS[j]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={(e) => {
          // A double click's second click (detail 2) would camp a second quarter.
          if ((e as MouseEvent).detail > 1) return;
          campUnderground(w, data, jobs);
          props.onChange();
        }}
      >
        Camp for the quarter
      </button>
    </section>
  );
}
