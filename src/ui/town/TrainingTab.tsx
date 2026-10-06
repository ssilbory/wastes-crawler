import { useState } from 'preact/hooks';
import type { Attribute } from '../../data/schemas/index.ts';
import { levelPlan, takeFreeFocus } from '../../game/character/advance.ts';
import { characterSheet } from '../../game/character/derived.ts';
import {
  boostAttribute,
  changeClass,
  prepareSpells,
  raiseSkill,
} from '../../game/character/training.ts';
import { levelUpMember, trainMember } from '../../game/world/training.ts';
import type { World } from '../../game/world/types.ts';
import { levelSummary } from '../../render/level-view.ts';
import { levelLine, pointsText } from '../../render/town-view.ts';
import { ATTRIBUTE_NAMES, className, classes, data, skillName, skills } from '../builder/data.ts';
import { FreeFocusForm } from './FocusPicker.tsx';
import { LevelUpForm } from './LevelUpForm.tsx';
import { cue } from '../sound.ts';
import type { Act } from './TownScreen.tsx';
import { spellName } from '../builder/MagicStep.tsx';

/** Leveling, spending skill points, preparing spells, and switching class. */
export function TrainingTab(props: { world: World; act: Act }) {
  const w = props.world;
  const living = w.members.filter((m) => !m.dead);
  const [who, setWho] = useState(living[0]?.id ?? '');
  const [skill, setSkill] = useState(skills[0]?.id ?? '');
  const [attribute, setAttribute] = useState<Attribute>('str');
  const [target, setTarget] = useState(classes[0]?.id ?? '');
  const [confirming, setConfirming] = useState(false);
  /** What the last level brought, for the member who took it. */
  const [summary, setSummary] = useState<{ who: string; lines: string[] } | null>(null);
  const m = living.find((x) => x.id === who) ?? living[0];
  if (!m) return <p class="hint">No one living can train.</p>;
  const c = m.character;
  const plan = levelPlan(data, c);
  const magic = characterSheet(c, data).magic;
  const train = (step: Parameters<typeof trainMember>[3]) =>
    props.act(() => trainMember(w, data, m.id, step));
  return (
    <>
      <section class="panel" aria-label="Training">
        <h2>Training</h2>
        <label>
          Who{' '}
          <select value={m.id} onChange={(e) => setWho((e.target as HTMLSelectElement).value)}>
            {living.map((x) => (
              <option key={x.id} value={x.id}>
                {x.character.name}
              </option>
            ))}
          </select>
        </label>
        <p>
          {className(c.classes.current)} · {levelLine(data, c)} · {pointsText(c)}
        </p>
      </section>
      {summary?.who === m.id && (
        <section class="panel" aria-label="Level up summary">
          <h3>Level up</h3>
          <ul>
            {summary.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button type="button" onClick={() => setSummary(null)}>
            Done
          </button>
        </section>
      )}
      {c.advancement.freeFoci && (
        <FreeFocusForm
          key={m.id}
          character={c}
          onTake={(choice) => train((x) => takeFreeFocus(data, x, choice))}
        />
      )}
      <section class="panel" aria-label="Skill points">
        <h3>Skill points</h3>
        <label>
          Skill{' '}
          <select value={skill} onChange={(e) => setSkill((e.target as HTMLSelectElement).value)}>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({c.skills[s.id] ?? '-'})
              </option>
            ))}
          </select>
        </label>{' '}
        <button type="button" onClick={() => train((x) => raiseSkill(data, x, skill))}>
          Raise {skillName(skill)}
        </button>
        <br />
        <label>
          Attribute{' '}
          <select
            value={attribute}
            onChange={(e) => setAttribute((e.target as HTMLSelectElement).value as Attribute)}
          >
            {(Object.keys(ATTRIBUTE_NAMES) as Attribute[]).map((a) => (
              <option key={a} value={a}>
                {ATTRIBUTE_NAMES[a]}
              </option>
            ))}
          </select>
        </label>{' '}
        <button type="button" onClick={() => train((x) => boostAttribute(data, x, attribute))}>
          Boost {ATTRIBUTE_NAMES[attribute]}
        </button>
      </section>
      {plan && (
        <LevelUpForm
          key={`${m.id}-${c.xp}-${plan.classLevel}-${plan.classId}`}
          character={c}
          plan={plan}
          onConfirm={(choices) => {
            const before = c;
            props.act(() => {
              const r = cue(levelUpMember(w, data, m.id, choices), 'level');
              if (r.ok) setSummary({ who: m.id, lines: levelSummary(data, before, m.character) });
              return r;
            });
          }}
        />
      )}
      {magic && (
        <section class="panel" aria-label="Prepared spells">
          <h3>Prepared spells ({magic.slots.spellsPrepared})</h3>
          {c.spells.known.map((id) => {
            const on = c.spells.prepared.includes(id);
            const next = on
              ? c.spells.prepared.filter((x) => x !== id)
              : [...c.spells.prepared, id];
            return (
              <label key={id} class="check">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => train((x) => prepareSpells(data, x, next))}
                />{' '}
                {spellName(id)}
              </label>
            );
          })}
        </section>
      )}
      <section class="panel" aria-label="Class">
        <h3>Class</h3>
        <p class="hint">
          New levels go into the current class. Switching needs 4th level in it, and earlier classes
          keep their levels. A switch can be taken back until a level is taken in the new class.
        </p>
        <label>
          Switch to{' '}
          <select value={target} onChange={(e) => setTarget((e.target as HTMLSelectElement).value)}>
            {classes.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>{' '}
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)}>
            Switch class
          </button>
        ) : (
          <div role="group" aria-label="Confirm class switch">
            <p>
              Switch {c.name} from {className(c.classes.current)} to {className(target)}? New levels
              will go into {className(target)}.
            </p>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                train((x) => changeClass(data, x, target));
              }}
            >
              Confirm switch
            </button>{' '}
            <button type="button" class="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        )}
      </section>
    </>
  );
}
