import { artHint, spellHint } from '../../render/describe-view.ts';
import type { Character } from '../../data/schemas/index.ts';
import type { LevelPlan } from '../../game/character/advance.ts';
import { classOption } from '../../game/character/class-step.ts';
import type { FocusChoice } from '../../game/character/foci.ts';
import { artChoices, learnableSpells } from '../../game/character/magic.ts';
import { data } from '../builder/data.ts';
import { FocusPicker, focusNeeds } from './FocusPicker.tsx';
import { HintButton } from '../hint.tsx';

function toggle(list: string[], id: string, max: number): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return list.length < max ? [...list, id] : list;
}

/** The spells the level could teach: the class's, up to its new spell level, not yet known. */
export function spellChoices(c: Character, plan: LevelPlan) {
  const mage = classOption(data, plan.classId)?.mage;
  if (!mage) return [];
  return learnableSpells(data, mage, plan.maxSpellLevel).filter(
    (s) => !c.spells.known.includes(s.id),
  );
}

/** How many arts and spells the level asks the player to pick, given what is left to learn. */
export function magicPicks(c: Character, plan: LevelPlan): { arts: number; spells: number } {
  return {
    arts: plan.arts.reduce(
      (n, p) => n + Math.min(p.picks, artChoices(data, p, c.arts, plan.classLevel).length),
      0,
    ),
    spells: Math.min(plan.spells, spellChoices(c, plan).length),
  };
}

/** What the foci screen still lacks. */
export const fociNeeds = (c: Character, foci: FocusChoice[]) =>
  foci.flatMap((choice) => focusNeeds(c, choice));

/** What the spells and abilities screen still lacks. */
export function magicNeeds(c: Character, plan: LevelPlan, arts: string[], spells: string[]) {
  const picks = magicPicks(c, plan);
  return [
    ...(arts.length < picks.arts ? [`Pick ${picks.arts - arts.length} more art(s).`] : []),
    ...(spells.length < picks.spells
      ? [`Pick ${picks.spells - spells.length} more spell(s).`]
      : []),
  ];
}

/** The level's focus picks. */
export function FociPicks(props: {
  character: Character;
  plan: LevelPlan;
  foci: FocusChoice[];
  onChange: (foci: FocusChoice[]) => void;
}) {
  const { foci } = props;
  return (
    <>
      {props.plan.focusPicks.map((slot, i) => (
        <FocusPicker
          key={i}
          label={`Focus (${slot})`}
          character={props.character}
          choice={foci[i] as FocusChoice}
          onChange={(choice) => props.onChange(foci.map((f, j) => (j === i ? choice : f)))}
        />
      ))}
    </>
  );
}

/** The level's new arts and spells. */
export function MagicPicks(props: {
  character: Character;
  plan: LevelPlan;
  arts: string[];
  spells: string[];
  onArts: (arts: string[]) => void;
  onSpells: (spells: string[]) => void;
}) {
  const { plan, character: c, arts, spells } = props;
  const allArts = plan.arts.reduce((n, x) => n + x.picks, 0);
  return (
    <>
      {plan.arts
        .filter((p) => p.picks > 0)
        .map((p) => (
          <fieldset key={p.tradition}>
            <legend>
              Arts ({p.picks} {p.tradition})
            </legend>
            {artChoices(data, p, c.arts, plan.classLevel).map((a) => (
              <div key={a.id} class="check-row">
                <label class="check">
                  <input
                    type="checkbox"
                    checked={arts.includes(a.id)}
                    onChange={() => props.onArts(toggle(arts, a.id, allArts))}
                  />{' '}
                  <span class="has-hint" title={artHint(data, a.id)}>
                    {a.name}
                  </span>
                </label>
                <HintButton name={a.name} text={artHint(data, a.id)} />
              </div>
            ))}
          </fieldset>
        ))}
      {plan.spells > 0 && (
        <fieldset>
          <legend>Spells ({plan.spells})</legend>
          {spellChoices(c, plan).map((s) => (
            <div key={s.id} class="check-row">
              <label class="check">
                <input
                  type="checkbox"
                  checked={spells.includes(s.id)}
                  onChange={() => props.onSpells(toggle(spells, s.id, plan.spells))}
                />{' '}
                <span class="has-hint" title={spellHint(data, s.id)}>
                  {s.name} (level {s.level})
                </span>
              </label>
              <HintButton name={s.name} text={spellHint(data, s.id)} />
            </div>
          ))}
        </fieldset>
      )}
    </>
  );
}
