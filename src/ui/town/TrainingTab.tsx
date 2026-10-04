import { useState } from 'preact/hooks';
import type { Attribute } from '../../data/schemas/index.ts';
import { levelPlan } from '../../game/character/advance.ts';
import { characterSheet } from '../../game/character/derived.ts';
import {
  boostAttribute,
  changeClass,
  prepareSpells,
  raiseSkill,
} from '../../game/character/training.ts';
import { levelUpMember, trainMember } from '../../game/world/training.ts';
import type { World } from '../../game/world/types.ts';
import { levelLine, pointsText } from '../../render/town-view.ts';
import { ATTRIBUTE_NAMES, className, classes, data, skillName, skills } from '../builder/data.ts';
import { LevelUpForm } from './LevelUpForm.tsx';
import { cue } from '../sound.ts';
import type { Act } from './TownScreen.tsx';

/** Leveling, spending skill points, preparing spells, and switching class. */
export function TrainingTab(props: { world: World; act: Act }) {
  const w = props.world;
  const living = w.members.filter((m) => !m.dead);
  const [who, setWho] = useState(living[0]?.id ?? '');
  const [skill, setSkill] = useState(skills[0]?.id ?? '');
  const [attribute, setAttribute] = useState<Attribute>('str');
  const [target, setTarget] = useState(classes[0]?.id ?? '');
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
      {plan && (
        <LevelUpForm
          key={`${m.id}-${c.xp}-${plan.classLevel}-${plan.classId}`}
          character={c}
          plan={plan}
          onConfirm={(choices) =>
            props.act(() => cue(levelUpMember(w, data, m.id, choices), 'level'))
          }
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
                {data.srd.spells.find((s) => s.id === id)?.name ?? id}
              </label>
            );
          })}
        </section>
      )}
      <section class="panel" aria-label="Class">
        <h3>Class</h3>
        <p class="hint">
          New levels go into the current class. Switching needs 4th level in it, and earlier classes
          keep their levels.
        </p>
        <label>
          Switch to{' '}
          <select value={target} onChange={(e) => setTarget((e.target as HTMLSelectElement).value)}>
            {classes.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <button type="button" onClick={() => train((x) => changeClass(data, x, target))}>
          Switch class
        </button>
      </section>
    </>
  );
}
