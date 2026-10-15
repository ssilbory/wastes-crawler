import { artHint, spellHint } from '../../render/describe-view.ts';
import { useState } from 'preact/hooks';
import type { Character } from '../../data/schemas/index.ts';
import { advance, type LevelChoices, type LevelPlan } from '../../game/character/advance.ts';
import { createRng } from '../../rules/rng.ts';
import { classOption } from '../../game/character/class-step.ts';
import type { FocusChoice } from '../../game/character/foci.ts';
import { artChoices, learnableSpells } from '../../game/character/magic.ts';
import { data } from '../builder/data.ts';
import { FocusPicker, focusNeeds } from './FocusPicker.tsx';
import { Hint } from '../hint.tsx';

function toggle(list: string[], id: string, max: number): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return list.length < max ? [...list, id] : list;
}

/** The choices a new level asks for: foci, arts, and spells. Hit points roll on confirming. */
export function LevelUpForm(props: {
  character: Character;
  plan: LevelPlan;
  onConfirm: (choices: LevelChoices) => void;
}) {
  const { plan, character: c } = props;
  const [foci, setFoci] = useState<FocusChoice[]>(plan.focusPicks.map(() => ({ id: '' })));
  const [arts, setArts] = useState<string[]>([]);
  const [spells, setSpells] = useState<string[]>([]);
  const mage = classOption(data, plan.classId)?.mage;
  const spellChoices = mage
    ? learnableSpells(data, mage, plan.maxSpellLevel).filter((s) => !c.spells.known.includes(s.id))
    : [];
  const setFocus = (i: number, choice: FocusChoice) =>
    setFoci(foci.map((f, j) => (j === i ? choice : f)));
  const artPicks = plan.arts.reduce(
    (n, p) => n + Math.min(p.picks, artChoices(data, p, c.arts, plan.classLevel).length),
    0,
  );
  const spellPicks = Math.min(plan.spells, spellChoices.length);
  // What the level still asks for, said beside the button so a refusal never goes unseen.
  const needed = [
    ...foci.flatMap((choice) => focusNeeds(c, choice)),
    ...(arts.length < artPicks ? [`Pick ${artPicks - arts.length} more art(s).`] : []),
    ...(spells.length < spellPicks ? [`Pick ${spellPicks - spells.length} more spell(s).`] : []),
  ];
  const choices = { foci: foci.filter((f) => f.id !== ''), arts, spells };
  // The game's own check decides; a throwaway RNG leaves the real one untouched.
  const check = advance(data, c, choices, createRng('level-check'));
  const shown = needed.length > 0 || check.ok ? needed : [check.reason];
  return (
    <section class="panel level-up" aria-label="Level up">
      <h3>Level up</h3>
      <p class="hint">
        Level {plan.classLevel} as {classOption(data, plan.classId)?.name}: +{plan.skillPoints}{' '}
        skill points{plan.quickPoints > 0 && ` and ${plan.quickPoints} Quick Learner point`}, to
        spend under Assign skill points.
      </p>
      {plan.focusPicks.map((slot, i) => (
        <FocusPicker
          key={i}
          label={`Focus (${slot})`}
          character={c}
          choice={foci[i] as FocusChoice}
          onChange={(choice) => setFocus(i, choice)}
        />
      ))}
      {plan.arts
        .filter((p) => p.picks > 0)
        .map((p) => (
          <fieldset key={p.tradition}>
            <legend>
              Arts ({p.picks} {p.tradition})
            </legend>
            {artChoices(data, p, c.arts, plan.classLevel).map((a) => (
              <label key={a.id} class="check">
                <input
                  type="checkbox"
                  checked={arts.includes(a.id)}
                  onChange={() =>
                    setArts(
                      toggle(
                        arts,
                        a.id,
                        plan.arts.reduce((n, x) => n + x.picks, 0),
                      ),
                    )
                  }
                />{' '}
                <Hint name={a.name} text={artHint(data, a.id)}>
                  {a.name}
                </Hint>
              </label>
            ))}
          </fieldset>
        ))}
      {plan.spells > 0 && (
        <fieldset>
          <legend>Spells ({plan.spells})</legend>
          {spellChoices.map((s) => (
            <label key={s.id} class="check">
              <input
                type="checkbox"
                checked={spells.includes(s.id)}
                onChange={() => setSpells(toggle(spells, s.id, plan.spells))}
              />{' '}
              <Hint name={s.name} text={spellHint(data, s.id)}>
                {s.name} (level {s.level})
              </Hint>
            </label>
          ))}
        </fieldset>
      )}
      {shown.length > 0 && (
        <ul class="hint needed" aria-label="Still needed">
          {shown.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        class="create"
        disabled={!check.ok}
        onClick={() => props.onConfirm(choices)}
      >
        Level up
      </button>
    </section>
  );
}
