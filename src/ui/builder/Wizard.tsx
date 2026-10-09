import type { Step, StepStatus } from '../../game/character/creation.ts';

/** The builder's steps in the SRD's order, with the names the step list shows. */
export const STEPS: readonly { id: Step; name: string }[] = [
  { id: 'people', name: 'People' },
  { id: 'attributes', name: 'Attributes' },
  { id: 'background', name: 'Background' },
  { id: 'class', name: 'Class' },
  { id: 'foci', name: 'Foci' },
  { id: 'magic', name: 'Magic' },
  { id: 'free-skill', name: 'Free skill' },
  { id: 'gear', name: 'Gear' },
  { id: 'identity', name: 'Name and goal' },
];

const MARK: Record<StepStatus['state'], string> = { ok: ' ✓', error: ' !', incomplete: '' };

/** The row of steps across the top: where you are, what's done, and a way to jump to any step. */
export function StepNav(props: {
  statuses: Record<Step, StepStatus>;
  at: number;
  onGo: (index: number) => void;
}) {
  return (
    <nav class="step-nav" aria-label="Character steps">
      <ol>
        {STEPS.map((s, i) => {
          const { state } = props.statuses[s.id];
          return (
            <li key={s.id}>
              <button
                type="button"
                class={`step-link step-link-${state}`}
                aria-current={i === props.at ? 'step' : undefined}
                onClick={() => props.onGo(i)}
              >
                <span class="step-num">{i + 1}</span> {s.name}
                {MARK[state]}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Back and Next, plus Create, which works from any step once every step is done. */
export function WizardFooter(props: {
  statuses: Record<Step, StepStatus>;
  at: number;
  onGo: (index: number) => void;
  complete: boolean;
  onCreate: () => void;
}) {
  const { at } = props;
  const next = STEPS[at + 1];
  const left = STEPS.filter((s) => props.statuses[s.id].state !== 'ok').map((s) => s.name);
  return (
    <div class="wizard-footer">
      <button type="button" disabled={at === 0} onClick={() => props.onGo(at - 1)}>
        ◂ Back
      </button>
      {next && (
        <button type="button" onClick={() => props.onGo(at + 1)}>
          Next: {next.name} ▸
        </button>
      )}
      <p class="hint">{left.length > 0 ? `Still to do: ${left.join(', ')}.` : 'Ready.'}</p>
      <button type="button" class="create" disabled={!props.complete} onClick={props.onCreate}>
        Create character
      </button>
    </div>
  );
}
