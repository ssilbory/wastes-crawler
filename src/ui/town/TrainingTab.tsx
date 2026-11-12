import { useState } from 'preact/hooks';
import { FormsTraining } from './FormsTraining.tsx';
import { levelPlan, takeFreeFocus } from '../../game/character/advance.ts';
import { characterSheet } from '../../game/character/derived.ts';
import { changeClass, prepareSpells } from '../../game/character/training.ts';
import { trainMember } from '../../game/world/training.ts';
import type { World } from '../../game/world/types.ts';
import { levelLine, pointsText } from '../../render/town-view.ts';
import { className, classes, data } from '../builder/data.ts';
import { FreeFocusForm } from './FocusPicker.tsx';
import { LevelUpDialog } from './LevelUpDialog.tsx';
import type { Act } from './TownScreen.tsx';
import { spellName } from '../builder/MagicStep.tsx';

/** Leveling and spending skill points (in a popup), preparing spells, and switching class. */
export function TrainingTab(props: { world: World; act: Act }) {
  const w = props.world;
  const living = w.members.filter((m) => !m.dead);
  const [who, setWho] = useState(living[0]?.id ?? '');
  const [target, setTarget] = useState(classes[0]?.id ?? '');
  const [confirming, setConfirming] = useState(false);
  const [leveling, setLeveling] = useState(false);
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
          <select
            value={m.id}
            onChange={(e) => {
              setWho((e.target as HTMLSelectElement).value);
              setConfirming(false);
              setLeveling(false);
            }}
          >
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
        <button type="button" class={plan ? 'create' : undefined} onClick={() => setLeveling(true)}>
          {plan ? 'Level up' : 'Spend skill points'}
        </button>
      </section>
      {c.advancement.freeFoci && (
        <FreeFocusForm
          key={m.id}
          character={c}
          onTake={(choice) => train((x) => takeFreeFocus(data, x, choice))}
        />
      )}
      {leveling && (
        <LevelUpDialog
          key={m.id}
          world={w}
          memberId={m.id}
          act={props.act}
          onClose={() => setLeveling(false)}
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
      <FormsTraining key={m.id} world={w} member={m} act={props.act} />
      <section class="panel" aria-label="Class">
        <h3>Class</h3>
        <p class="hint">
          New levels go into the current class. Switching needs 4th level in it, and earlier classes
          keep their levels. A switch can be taken back until a level is taken in the new class.
        </p>
        <label>
          Switch to{' '}
          <select
            value={target}
            onChange={(e) => {
              setTarget((e.target as HTMLSelectElement).value);
              setConfirming(false);
            }}
          >
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
