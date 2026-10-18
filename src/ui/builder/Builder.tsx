import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Character } from '../../data/schemas/index.ts';
import { rollAttributes } from '../../game/character/attributes.ts';
import {
  evaluateChoices,
  finishCharacter,
  rollBackground,
  type Choices,
} from '../../game/character/creation.ts';
import { previewSheet } from '../../game/character/derived.ts';
import { classOption } from '../../game/character/class-step.ts';
import { rollStartingCrowns } from '../../game/character/gear.ts';
import type { RosterEntry } from '../../game/character/roster.ts';
import { asEdit, sameName } from '../../game/character/roster-edit.ts';
import { withoutFocusSkills } from '../../game/character/foci.ts';
import { backgroundOpenTo, findPeople } from '../../game/character/people.ts';
import { ConfirmButton } from '../confirm.tsx';
import { AttributesStep } from './AttributesStep.tsx';
import { BackgroundStep } from './BackgroundStep.tsx';
import { data, freshRng } from './data.ts';
import { download } from './download.ts';
import { FociStep } from './FociStep.tsx';
import { GearStep } from './GearStep.tsx';
import { MagicStep } from './MagicStep.tsx';
import { ClassStep, FreeSkillStep, IdentityStep } from './OtherSteps.tsx';
import { PeopleStep } from './PeopleStep.tsx';
import { CharacterSheet, PreviewSheet } from './Sheet.tsx';
import { StepNav, WizardFooter } from './Wizard.tsx';

/** What saving does: over the original under its own name, else as a new character. */
export function saveLabel(original: RosterEntry | undefined, name: string): string {
  if (!original) return 'Save character';
  return sameName(original.character.name, name)
    ? `Save over ${original.character.name}`
    : 'Save as a new character';
}

/**
 * The character builder: a new character from `initial`'s empty picks, or a saved one opened
 * again. `onSave` is false when the character couldn't be stored.
 */
export function Builder(props: {
  initial: Choices;
  original?: RosterEntry | undefined;
  notice?: string | undefined;
  onSave: (character: Character, choices: Choices) => boolean;
  onCancel: () => void;
}) {
  const rng = useRef(freshRng());
  const [choices, setChoices] = useState<Choices>(props.initial);
  const [character, setCharacter] = useState<Character | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  /** The wizard step on screen. Every step stays mounted so its own picks survive moving on. */
  const [at, setAt] = useState(0);
  const pages = useRef<HTMLDivElement>(null);
  useEffect(() => pages.current?.scrollTo(0, 0), [at]);

  const ev = useMemo(() => evaluateChoices(choices, data), [choices]);
  const option = choices.classId === null ? undefined : classOption(data, choices.classId);
  const preview = useMemo(() => previewSheet(ev, choices.classId, data), [ev, choices.classId]);
  const update = (patch: Partial<Choices>) => setChoices((c) => ({ ...c, ...patch }));
  // A background sets the skills the foci build on, so its change re-asks each focus's skill.
  const setBackground = (background: Choices['background']) =>
    update({ background, foci: withoutFocusSkills(choices.foci) });

  const create = () => {
    const result = finishCharacter(choices, data, rng.current);
    if (result.ok) {
      setCharacter(asEdit(props.original, result.character));
      setErrors([]);
    } else setErrors(result.errors);
  };

  const save = (c: Character) => {
    if (!props.onSave(c, choices))
      setErrors(['Browser storage is unavailable, so the character wasn’t saved.']);
  };

  const name = props.original?.character.name;
  return (
    <div class="builder">
      <header>
        <h1>{name === undefined ? 'New character' : `Editing ${name}`}</h1>
        <ConfirmButton
          class="secondary"
          ask={choices !== props.initial}
          confirm="Leave without saving"
          onConfirm={props.onCancel}
        >
          Back to characters
        </ConfirmButton>
      </header>
      {props.notice && <p class="hint">{props.notice}</p>}
      {errors.length > 0 && (
        <ul class="errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {character ? (
        <main class="done">
          <CharacterSheet character={character} />
          <div class="actions">
            <button type="button" class="create" onClick={() => save(character)}>
              {saveLabel(props.original, character.name)}
            </button>
            <button type="button" onClick={() => download(character)}>
              Export JSON
            </button>
            <button type="button" onClick={() => setCharacter(null)}>
              Back to the steps
            </button>
          </div>
        </main>
      ) : (
        <main class="wizard">
          <StepNav statuses={ev.steps} at={at} onGo={setAt} />
          <div class="wizard-body">
            <div class="wizard-pages" ref={pages}>
              <div class="wizard-page" hidden={at !== 0}>
                <PeopleStep
                  people={choices.people}
                  lineage={choices.lineage}
                  status={ev.steps.people}
                  onChange={(people, lineage) => {
                    // Drop a background the new people can't take.
                    const bg = data.content.backgrounds.find(
                      (b) => b.id === choices.background?.id,
                    );
                    const keep = bg !== undefined && backgroundOpenTo(bg, people);
                    update({
                      people,
                      lineage,
                      foci: [],
                      gear: null,
                      ...(keep ? {} : { background: null }),
                    });
                  }}
                />
              </div>
              <div class="wizard-page" hidden={at !== 1}>
                <AttributesStep
                  method={choices.attributeMethod}
                  scores={choices.array}
                  status={ev.steps.attributes}
                  roll={() => rollAttributes(rng.current)}
                  onChange={({ method, scores }) =>
                    update({ attributeMethod: method, array: scores })
                  }
                />
              </div>
              <div class="wizard-page" hidden={at !== 2}>
                <BackgroundStep
                  choices={choices}
                  status={ev.steps.background}
                  onChange={setBackground}
                  onRoll={(tables) =>
                    choices.background &&
                    setBackground({
                      id: choices.background.id,
                      choice: { mode: 'roll', rolls: rollBackground(rng.current, tables) },
                    })
                  }
                />
              </div>
              <div class="wizard-page" hidden={at !== 3}>
                <ClassStep
                  value={choices.classId}
                  status={ev.steps.class}
                  replacing={ev.classReplacing}
                  replacements={choices.classSkills}
                  onChange={(classId) =>
                    update({ classId, classSkills: [], foci: [], magic: null, forms: [] })
                  }
                  onReplace={(i, skill) => {
                    const classSkills = [...choices.classSkills];
                    classSkills[i] = skill;
                    update({ classSkills: Array.from(classSkills, (s) => s ?? null) });
                  }}
                />
              </div>
              <div class="wizard-page" hidden={at !== 4}>
                <FociStep
                  slots={ev.focusSlots}
                  choices={choices.foci}
                  skillsBefore={ev.focusSkillsBefore}
                  fallbackSkills={ev.skills}
                  status={ev.steps.foci}
                  ready={
                    ev.steps.class.state === 'ok' &&
                    ev.steps.background.state === 'ok' &&
                    ev.focusSlots.length > 0
                  }
                  onChange={(foci) => update({ foci })}
                />
              </div>
              <div class="wizard-page" hidden={at !== 5}>
                <MagicStep
                  option={ev.steps.class.state === 'ok' ? option : undefined}
                  choice={choices.magic}
                  status={ev.steps.magic}
                  intModifier={ev.intModifier}
                  onChange={(magic) => update({ magic })}
                  forms={choices.forms ?? []}
                  onForms={(forms) => update({ forms })}
                />
              </div>
              <div class="wizard-page" hidden={at !== 6}>
                <FreeSkillStep
                  value={choices.freeSkill}
                  status={ev.steps['free-skill']}
                  onChange={(freeSkill) => update({ freeSkill })}
                />
              </div>
              <div class="wizard-page" hidden={at !== 7}>
                <GearStep
                  people={
                    ev.steps.people.state === 'ok' && ev.scores
                      ? findPeople(data, choices.people)
                      : undefined
                  }
                  choice={choices.gear}
                  inventory={ev.inventory}
                  crownsTenths={ev.crownsTenths}
                  status={ev.steps.gear}
                  onRoll={() =>
                    choices.gear?.mode === 'shop' &&
                    update({
                      gear: { ...choices.gear, crowns: rollStartingCrowns(rng.current, data) },
                    })
                  }
                  onChange={(gear) => update({ gear })}
                />
              </div>
              <div class="wizard-page" hidden={at !== 8}>
                <IdentityStep
                  name={choices.name}
                  goal={choices.goal}
                  status={ev.steps.identity}
                  onChange={update}
                />
              </div>
            </div>
            <PreviewSheet
              preview={preview}
              skills={ev.skills}
              equipment={ev.equipment}
              effort={ev.effort}
            />
          </div>
          <WizardFooter
            statuses={ev.steps}
            at={at}
            onGo={setAt}
            complete={ev.complete}
            onCreate={create}
          />
        </main>
      )}
    </div>
  );
}
