import type { ClassOption } from '../../data/schemas/index.ts';
import type { MagicChoice, StepStatus } from '../../game/character/creation.ts';
import { findTradition } from '../../game/character/class-step.ts';
import { artChoices, artPicks, learnableSpells, spellSlots } from '../../game/character/magic.ts';
import { data } from './data.ts';
import { Step } from './Field.tsx';
import { gameSpells } from '../../data/spells.ts';
import { artHint } from '../../render/describe-view.ts';

const artName = (id: string) => data.srd.arts.find((a) => a.id === id)?.name ?? id;
export const spellName = (id: string) =>
  gameSpells(data.srd, data.content).find((s) => s.id === id)?.name ?? id;

function toggle(list: readonly string[], id: string, on: boolean): string[] {
  return on ? [...list, id] : list.filter((x) => x !== id);
}

function Check(props: {
  label: string;
  checked: boolean;
  title?: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <label class="check" title={props.title}>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange((e.target as HTMLInputElement).checked)}
      />
      {props.label}
    </label>
  );
}

/** Arts and starting spells for Mage classes (SRD 1.5.10, 1.5.7, 1.7.5, 4.1.0). */
export function MagicStep(props: {
  option: ClassOption | undefined;
  choice: MagicChoice | null;
  status: StepStatus;
  onChange: (choice: MagicChoice) => void;
}) {
  const mage = props.option?.mage;
  const choice = props.choice ?? { arts: [], known: [], prepared: [] };
  const set = (patch: Partial<MagicChoice>) => props.onChange({ ...choice, ...patch });
  if (!props.option) {
    return (
      <Step title="6. Magic" status={props.status}>
        <p class="hint">Choose a class first.</p>
      </Step>
    );
  }
  if (!mage) {
    return (
      <Step title="6. Magic" status={props.status}>
        <p class="hint">{props.option.name} characters don’t cast spells.</p>
      </Step>
    );
  }
  const slots = spellSlots(data, mage);
  const spells = learnableSpells(data, mage, slots.maxSpellLevel);
  return (
    <Step title="6. Magic" status={props.status}>
      {artPicks(data, mage).map((p) => {
        const tradition = findTradition(data, p.tradition)?.name ?? p.tradition;
        const options = artChoices(data, p, [], 1);
        return (
          <fieldset key={p.tradition} class="picks">
            <legend>
              {tradition} arts: pick {p.picks}
              {p.automatic.length > 0 && `, plus ${p.automatic.map(artName).join(' and ')}`}
            </legend>
            {options.map((a) => (
              <Check
                key={a.id}
                label={a.name}
                title={artHint(data, a.id)}
                checked={choice.arts.includes(a.id)}
                onChange={(on) => set({ arts: toggle(choice.arts, a.id, on) })}
              />
            ))}
          </fieldset>
        );
      })}
      {mage.startingSpells === 0 ? (
        <p class="hint">No spells: miracles alone, worked with Effort, and unhindered by armor.</p>
      ) : (
        <>
          <fieldset class="picks">
            <legend>Spells known: pick {Math.min(mage.startingSpells, spells.length)}</legend>
            {spells.map((s) => (
              <Check
                key={s.id}
                label={s.name}
                title={s.text}
                checked={choice.known.includes(s.id)}
                onChange={(on) =>
                  set({
                    known: toggle(choice.known, s.id, on),
                    prepared: on ? choice.prepared : choice.prepared.filter((x) => x !== s.id),
                  })
                }
              />
            ))}
          </fieldset>
          {choice.known.length > 0 && (
            <fieldset class="picks">
              <legend>Prepared: up to {slots.spellsPrepared}</legend>
              {choice.known.map((id) => (
                <Check
                  key={id}
                  label={`Prepare ${spellName(id)}`}
                  checked={choice.prepared.includes(id)}
                  onChange={(on) => set({ prepared: toggle(choice.prepared, id, on) })}
                />
              ))}
            </fieldset>
          )}
          <p class="hint">
            Casts {slots.spellsCast} spell{slots.spellsCast === 1 ? '' : 's'} a day. A known spell
            can also be cast for System Strain equal to its level.
          </p>
        </>
      )}
    </Step>
  );
}
