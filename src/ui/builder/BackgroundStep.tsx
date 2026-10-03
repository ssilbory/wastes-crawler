import {
  BACKGROUND_PICKS,
  evaluateChoices,
  type BackgroundChoice,
  type Choices,
  type PickedEntry,
  type StepStatus,
} from '../../game/character/creation.ts';
import { backgroundOpenTo } from '../../game/character/people.ts';
import type { Skills } from '../../game/character/skills.ts';
import { BackgroundRolls } from './BackgroundRolls.tsx';
import { data, entryLabel, skillName } from './data.ts';
import { EntrySkillChoice } from './EntryChoice.tsx';
import { Select, Step } from './Field.tsx';

type Table = 'growth' | 'learning';

/** Choose a background, then pick two Learning entries or roll three times (SRD 1.3.2). */
export function BackgroundStep(props: {
  choices: Choices;
  status: StepStatus;
  onChange: (background: Choices['background']) => void;
  onRoll: (tables: Table[]) => void;
}) {
  const chosen = props.choices.background;
  const bg = chosen ? data.content.backgrounds.find((b) => b.id === chosen.id) : undefined;
  const setChoice = (choice: BackgroundChoice) => chosen && props.onChange({ ...chosen, choice });

  /** Skills before entry i, so the UI knows when a named skill needs a replacement. */
  const priorFor = (i: number): Skills => {
    if (!chosen) return {};
    const c = chosen.choice;
    const choice: BackgroundChoice =
      c.mode === 'pick'
        ? { mode: 'pick', picks: c.picks.slice(0, i) }
        : { mode: 'roll', rolls: c.rolls.slice(0, i) };
    return evaluateChoices(
      { ...props.choices, background: { id: chosen.id, choice }, freeSkill: null },
      data,
    ).skills;
  };

  return (
    <Step title="3. Background" status={props.status}>
      <Select
        label="Background"
        value={chosen?.id ?? ''}
        options={data.content.backgrounds
          .filter((b) => props.choices.people === '' || backgroundOpenTo(b, props.choices.people))
          .map((b) => ({ value: b.id, label: b.name }))}
        onChange={(id) =>
          props.onChange(id === '' ? null : { id, choice: { mode: 'pick', picks: [] } })
        }
      />
      {bg && chosen && (
        <>
          <p class="hint">
            {bg.description} Free skill: {skillName(bg.freeSkill)}.
          </p>
          <fieldset class="mode">
            <legend>Skills</legend>
            {(['pick', 'roll'] as const).map((mode) => (
              <label key={mode}>
                <input
                  type="radio"
                  name="background-mode"
                  checked={chosen.choice.mode === mode}
                  onChange={() =>
                    setChoice(mode === 'pick' ? { mode, picks: [] } : { mode, rolls: [] })
                  }
                />
                {mode === 'pick' ? 'Pick two Learning entries' : 'Roll three times'}
              </label>
            ))}
          </fieldset>
          {chosen.choice.mode === 'pick' ? (
            <Picks
              picks={chosen.choice.picks}
              learning={bg.learning}
              priorFor={priorFor}
              onChange={(picks) => setChoice({ mode: 'pick', picks })}
            />
          ) : (
            <BackgroundRolls
              background={bg}
              rolls={chosen.choice.rolls.length > 0 ? chosen.choice.rolls : null}
              priorFor={priorFor}
              onRoll={props.onRoll}
              onChange={(rolls) => setChoice({ mode: 'roll', rolls })}
            />
          )}
        </>
      )}
    </Step>
  );
}

function Picks(props: {
  picks: PickedEntry[];
  learning: (typeof data.content.backgrounds)[number]['learning'];
  priorFor: (i: number) => Skills;
  onChange: (picks: PickedEntry[]) => void;
}) {
  const options = props.learning.map((e, i) => ({ value: String(i), label: entryLabel(e) }));
  const slots = Array.from({ length: BACKGROUND_PICKS }, (_, i) => i);
  return (
    <div class="picks">
      {slots.map((i) => {
        // Picks apply in order, so a slot opens only once the one before it is filled.
        if (i > props.picks.length) return null;
        const pick = props.picks[i];
        const entry = pick ? props.learning[pick.index] : undefined;
        const label = `Learning pick ${i + 1}`;
        return (
          <div key={i} class="pick">
            <Select
              label={label}
              value={pick ? String(pick.index) : ''}
              options={options}
              onChange={(v) =>
                props.onChange(
                  v === '' ? props.picks.slice(0, i) : [...props.picks.slice(0, i), { index: +v }],
                )
              }
            />
            {pick && entry && (
              <EntrySkillChoice
                label={label.toLowerCase()}
                entry={entry}
                prior={props.priorFor(i)}
                value={pick.skill}
                onChange={(skill) => {
                  const next = props.picks.slice(0, i + 1);
                  next[i] =
                    skill === undefined ? { index: pick.index } : { index: pick.index, skill };
                  props.onChange(next);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
