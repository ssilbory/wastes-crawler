import { focusHint } from '../../render/describe-view.ts';
import { useState } from 'preact/hooks';
import type { Attribute, Character } from '../../data/schemas/index.ts';
import { allowedSkills, focusInfo, type FocusChoice } from '../../game/character/foci.ts';
import { ATTRIBUTE_NAMES, data, skillName } from '../builder/data.ts';

const pickable = data.content.focusRules
  .filter((r) => r.availability === 'pickable')
  .map((r) => focusInfo(data, r.id))
  .filter((f) => f !== undefined);

/** What a focus choice still lacks: the focus, its bonus skill, or its attribute. */
export function focusNeeds(c: Character, choice: FocusChoice): string[] {
  const f = focusInfo(data, choice.id);
  if (!f) return ['Choose a focus.'];
  if (c.foci.some((h) => h.id === f.id)) return [];
  const skills = f.bonusSkill ? allowedSkills(data, f.bonusSkill) : [];
  return [
    ...(skills.length > 1 && !choice.skill ? [`Choose a skill for ${f.name}.`] : []),
    ...(f.attributeChoice && !choice.attribute ? [`Choose an attribute for ${f.name}.`] : []),
  ];
}

/** One focus pick: the focus, then its bonus skill or attribute where it asks for one. */
export function FocusPicker(props: {
  label: string;
  choice: FocusChoice;
  onChange: (choice: FocusChoice) => void;
}) {
  const { choice } = props;
  const f = focusInfo(data, choice.id);
  const skills = f?.bonusSkill ? allowedSkills(data, f.bonusSkill) : [];
  return (
    <div class="pick">
      <label>
        {props.label}{' '}
        <select
          value={choice.id}
          onChange={(e) => props.onChange({ id: (e.target as HTMLSelectElement).value })}
        >
          <option value="">Choose…</option>
          {pickable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {f && <p class="hint focus-hint">{focusHint(data, f.id)}</p>}
      {skills.length > 1 && (
        <label>
          {' '}
          Skill{' '}
          <select
            value={choice.skill ?? ''}
            onChange={(e) =>
              props.onChange({ ...choice, skill: (e.target as HTMLSelectElement).value })
            }
          >
            <option value="">Choose…</option>
            {skills.map((s) => (
              <option key={s} value={s}>
                {skillName(s)}
              </option>
            ))}
          </select>
        </label>
      )}
      {f?.attributeChoice && (
        <label>
          {' '}
          Attribute{' '}
          <select
            value={choice.attribute ?? ''}
            onChange={(e) =>
              props.onChange({
                ...choice,
                attribute: (e.target as HTMLSelectElement).value as Attribute,
              })
            }
          >
            <option value="">Choose…</option>
            {(Object.keys(ATTRIBUTE_NAMES) as Attribute[]).map((a) => (
              <option key={a} value={a}>
                {ATTRIBUTE_NAMES[a]}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/** Focus picks owed for a focus the game took away, taken whenever the player likes. */
export function FreeFocusForm(props: {
  character: Character;
  onTake: (choice: FocusChoice) => void;
}) {
  const c = props.character;
  const [choice, setChoice] = useState<FocusChoice>({ id: '' });
  const needed = focusNeeds(c, choice);
  return (
    <section class="panel" aria-label="Owed focus picks">
      <h3>Owed focus picks ({c.advancement.freeFoci})</h3>
      <p class="hint">A focus the game no longer offers was swapped for a free pick.</p>
      <FocusPicker label="Focus" choice={choice} onChange={setChoice} />
      <button
        type="button"
        disabled={needed.length > 0}
        onClick={() => {
          props.onTake(choice);
          setChoice({ id: '' });
        }}
      >
        Take the focus
      </button>
    </section>
  );
}
