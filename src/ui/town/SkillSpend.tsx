import type { Attribute, Character } from '../../data/schemas/index.ts';
import { spendPoints, type SpendStep, type TrainResult } from '../../game/character/training.ts';
import { attributeLabel } from '../../render/attribute-view.ts';
import { pointsText } from '../../render/town-view.ts';
import { ATTRIBUTE_NAMES, data, skillName, skills } from '../builder/data.ts';

const total = (c: Character) => c.advancement.skillPoints + c.advancement.quickPoints;

/** What one more step would cost, or why it can't be taken. */
function trial(c: Character, step: SpendStep): { cost: number } | { reason: string } {
  const r: TrainResult = spendPoints(data, c, [step]);
  return r.ok ? { cost: total(c) - total(r.character) } : { reason: r.reason };
}

const stepName = (s: SpendStep) =>
  s.kind === 'skill' ? skillName(s.id) : ATTRIBUTE_NAMES[s.id as Attribute];

/** Plans skill raises and attribute boosts against `base`, which already holds the new points. */
export function SkillSpend(props: {
  base: Character;
  steps: SpendStep[];
  onChange: (steps: SpendStep[]) => void;
}) {
  const r = spendPoints(data, props.base, props.steps);
  // Each step is only added once it succeeds, so the plan always holds.
  const c = r.ok ? r.character : props.base;
  const add = (step: SpendStep) => props.onChange([...props.steps, step]);
  const button = (step: SpendStep, label: string) => {
    const t = trial(c, step);
    return (
      <button
        type="button"
        class="spend"
        aria-label={label}
        disabled={'reason' in t}
        title={'reason' in t ? t.reason : `${t.cost} point${t.cost === 1 ? '' : 's'}`}
        onClick={() => add(step)}
      >
        {'reason' in t ? '—' : `+ (${t.cost})`}
      </button>
    );
  };
  return (
    <>
      <p aria-live="polite">Points left: {pointsText(c)}</p>
      {props.steps.length > 0 && (
        <div class="spend-plan">
          <span>Planned: {props.steps.map(stepName).join(', ')}</span>{' '}
          <button
            type="button"
            class="secondary"
            onClick={() => props.onChange(props.steps.slice(0, -1))}
          >
            Undo
          </button>{' '}
          <button type="button" class="secondary" onClick={() => props.onChange([])}>
            Clear
          </button>
        </div>
      )}
      <div class="spend-columns">
        <table class="spend-table" aria-label="Skills">
          <tbody>
            {skills.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{c.skills[s.id] ?? '-'}</td>
                <td>{button({ kind: 'skill', id: s.id }, `Raise ${s.name}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table class="spend-table" aria-label="Attributes">
          <tbody>
            {(Object.keys(ATTRIBUTE_NAMES) as Attribute[]).map((a) => (
              <tr key={a}>
                <td>{attributeLabel(data, c, a, ATTRIBUTE_NAMES[a])}</td>
                <td>{button({ kind: 'attribute', id: a }, `Boost ${ATTRIBUTE_NAMES[a]}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
