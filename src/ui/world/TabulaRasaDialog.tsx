import { useMemo, useState } from 'preact/hooks';
import { classOption } from '../../game/character/class-step.ts';
import { evaluateChoices, rollBackground, type Choices } from '../../game/character/creation.ts';
import { previewSheet } from '../../game/character/derived.ts';
import { withoutFocusSkills } from '../../game/character/foci.ts';
import { blankSlate } from '../../game/character/tabula-rasa.ts';
import { drink } from '../../game/world/potions.ts';
import type { Member, World } from '../../game/world/types.ts';
import { BackgroundStep } from '../builder/BackgroundStep.tsx';
import { data, skillName, skills } from '../builder/data.ts';
import { Select } from '../builder/Field.tsx';
import { FociStep } from '../builder/FociStep.tsx';
import { MagicStep } from '../builder/MagicStep.tsx';
import { FreeSkillStep } from '../builder/OtherSteps.tsx';
import { PreviewSheet } from '../builder/Sheet.tsx';
import { SheetDialog } from './SheetDialog.tsx';

/**
 * Tabula Rasa (docs/rules-adaptation.md, Potions: Tabula Rasa): the target's 1st-level picks made
 * anew, with who they are kept. Nothing is drunk until the last button; closing keeps the potion.
 */
export function TabulaRasaDialog(props: {
  world: World;
  holder: Member;
  target: Member;
  potion: string;
  onDone: (message: string | null) => void;
  onClose: () => void;
}) {
  const c = props.target.character;
  const [choices, setChoices] = useState<Choices>(() => blankSlate(c));
  const [errors, setErrors] = useState<string[]>([]);
  const ev = useMemo(() => evaluateChoices(choices, data), [choices]);
  const preview = useMemo(() => previewSheet(ev, choices.classId, data), [ev, choices.classId]);
  const update = (patch: Partial<Choices>) => setChoices((x) => ({ ...x, ...patch }));
  const setBackground = (background: Choices['background']) =>
    update({ background, foci: withoutFocusSkills(choices.foci) });
  const option = classOption(data, c.classes.current);
  const begin = () => {
    const r = drink(props.world, data, props.holder.id, props.potion, props.target.id, choices);
    if (r.ok) props.onDone(null);
    else setErrors([r.reason]);
  };

  return (
    <SheetDialog title={`Tabula Rasa: ${c.name}`} onClose={props.onClose}>
      <p class="hint">
        {c.name} keeps their people, attributes, background, class, gear, and {c.xp} XP, and makes
        their 1st-level picks anew. They level back up in town.
      </p>
      <div class="wizard-body">
        <div class="wizard-pages">
          <BackgroundStep
            fixed
            choices={choices}
            status={ev.steps.background}
            onChange={setBackground}
            onRoll={(tables) =>
              setBackground({
                id: c.background,
                choice: { mode: 'roll', rolls: rollBackground(props.world.rng, tables) },
              })
            }
          />
          {ev.classReplacing.map(
            (skill, i) =>
              skill && (
                <Select
                  key={i}
                  label={`Replacement for ${skillName(skill)} (class bonus skill)`}
                  value={choices.classSkills[i] ?? ''}
                  options={skills.map((s) => ({ value: s.id, label: s.name }))}
                  onChange={(v) => {
                    const classSkills = [...choices.classSkills];
                    classSkills[i] = v === '' ? null : v;
                    update({ classSkills: Array.from(classSkills, (s) => s ?? null) });
                  }}
                />
              ),
          )}
          <FociStep
            slots={ev.focusSlots}
            choices={choices.foci}
            skillsBefore={ev.focusSkillsBefore}
            fallbackSkills={ev.skills}
            status={ev.steps.foci}
            ready={ev.steps.background.state === 'ok' && ev.focusSlots.length > 0}
            onChange={(foci) => update({ foci })}
          />
          <MagicStep
            option={option}
            choice={choices.magic}
            status={ev.steps.magic}
            intModifier={ev.intModifier}
            onChange={(magic) => update({ magic })}
            forms={choices.forms ?? []}
            onForms={(forms) => update({ forms })}
          />
          <FreeSkillStep
            value={choices.freeSkill}
            status={ev.steps['free-skill']}
            onChange={(freeSkill) => update({ freeSkill })}
          />
        </div>
        <PreviewSheet
          preview={preview}
          skills={ev.skills}
          equipment={ev.equipment}
          effort={ev.effort}
        />
      </div>
      {errors.length > 0 && (
        <ul class="errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div class="actions">
        <button type="button" class="create" disabled={!ev.complete} onClick={begin}>
          Drink and begin anew
        </button>
      </div>
    </SheetDialog>
  );
}
