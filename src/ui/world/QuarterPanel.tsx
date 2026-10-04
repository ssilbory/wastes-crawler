import type { Activity, Member, QuarterPlan } from '../../game/world/types.ts';

const ACTIVITIES: Record<Activity, string> = {
  rest: 'Rest',
  sleep: 'Sleep',
  'make-camp': 'Make camp',
  watch: 'Keep watch',
  forage: 'Forage',
  hunt: 'Hunt or fish',
};

interface Choice {
  id: string;
  name: string;
}

function MemberSelect(props: {
  label: string;
  members: Choice[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <label>
      {props.label}{' '}
      <select
        value={props.value ?? ''}
        onChange={(e) => props.onChange((e.target as HTMLSelectElement).value || null)}
      >
        <option value="">Nobody</option>
        {props.members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The plan for the coming quarter, prefilled with the suggestion. */
export function QuarterPanel(props: {
  members: Member[];
  /** Wilderness Guides who can lead the way. */
  guides: Choice[];
  plan: QuarterPlan;
  canHike: boolean;
  onPlan: (plan: QuarterPlan) => void;
  onPass: () => void;
  onHike: () => void;
  onCamp: () => void;
}) {
  const { plan } = props;
  const people = props.members.map((m) => ({ id: m.id, name: m.character.name }));
  return (
    <section class="panel quarter-panel" aria-label="Quarter plan">
      <h2>This quarter</h2>
      <div class="tabs" role="radiogroup" aria-label="Plan">
        <button
          type="button"
          role="radio"
          aria-checked={plan.kind === 'hike'}
          disabled={!props.canHike}
          onClick={props.onHike}
        >
          Hike
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={plan.kind === 'camp'}
          onClick={props.onCamp}
        >
          Camp
        </button>
      </div>
      {!props.canHike && <p class="hint">Click a hex on the map to set a destination.</p>}
      {plan.kind === 'hike' ? (
        <div class="roles">
          <MemberSelect
            label="Lead the way"
            members={[...people, ...props.guides]}
            value={plan.leader}
            onChange={(leader) => props.onPlan({ ...plan, leader })}
          />
          <MemberSelect
            label="Keep watch"
            members={people}
            value={plan.watcher}
            onChange={(watcher) => props.onPlan({ ...plan, watcher })}
          />
        </div>
      ) : (
        <div class="roles">
          {props.members.map((m) => (
            <label key={m.id}>
              {m.character.name}{' '}
              <select
                value={plan.activities[m.id] ?? 'rest'}
                onChange={(e) =>
                  props.onPlan({
                    kind: 'camp',
                    activities: {
                      ...plan.activities,
                      [m.id]: (e.target as HTMLSelectElement).value as Activity,
                    },
                  })
                }
              >
                {Object.entries(ACTIVITIES).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <button type="button" class="create" onClick={props.onPass}>
        Pass the quarter
      </button>
    </section>
  );
}
