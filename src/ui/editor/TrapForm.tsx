import type { Attribute, Trap } from '../../data/schemas/index.ts';
import { ATTRIBUTES } from '../../game/character/attributes.ts';
import { data, skills } from '../builder/data.ts';

const SAVES = ['physical', 'evasion', 'mental', 'luck'] as const;

function NumberField(props: {
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <label class="field">
      <span>{props.label}</span>
      <input
        type="number"
        min={props.min}
        value={props.value}
        onInput={(e) => {
          const v = Number((e.target as HTMLInputElement).value);
          if (Number.isInteger(v) && v >= props.min) props.onChange(v);
        }}
        // A refused entry isn't kept; leaving the field shows the value that was.
        onBlur={(e) => {
          (e.target as HTMLInputElement).value = String(props.value);
        }}
      />
    </label>
  );
}

/** A trap's name, how hard it is to spot and disarm, the save, and what it does. */
export function TrapForm(props: { trap: Trap; onChange: (t: Trap) => void }) {
  const { trap } = props;
  const set = (patch: Partial<Trap>) => props.onChange({ ...trap, ...patch });
  const disarm = (patch: Partial<Trap['disarm']>) => set({ disarm: { ...trap.disarm, ...patch } });
  const effect = trap.effect;
  return (
    <fieldset>
      <legend>Trap</legend>
      <label class="field">
        <span>Name</span>
        <input
          value={trap.name}
          onInput={(e) => {
            const name = (e.target as HTMLInputElement).value;
            if (name.trim()) set({ name });
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).value = trap.name;
          }}
        />
      </label>
      <NumberField
        label="Notice difficulty"
        value={trap.notice}
        min={1}
        onChange={(notice) => set({ notice })}
      />
      <label class="field">
        <span>Disarm skill</span>
        <select
          value={trap.disarm.skill}
          onChange={(e) => disarm({ skill: (e.target as HTMLSelectElement).value })}
        >
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div class="field">
        <span>Disarm attributes</span>
        {ATTRIBUTES.map((a) => (
          <label key={a} class="check">
            <input
              type="checkbox"
              checked={trap.disarm.attributes.includes(a)}
              onChange={(e) => {
                const on = (e.target as HTMLInputElement).checked;
                const next: Attribute[] = on
                  ? [...trap.disarm.attributes, a]
                  : trap.disarm.attributes.filter((x) => x !== a);
                if (next.length > 0) disarm({ attributes: next });
              }}
            />{' '}
            {a}
          </label>
        ))}
      </div>
      <NumberField
        label="Disarm difficulty"
        value={trap.disarm.difficulty}
        min={1}
        onChange={(difficulty) => disarm({ difficulty })}
      />
      <label class="field">
        <span>Save</span>
        <select
          value={trap.save ?? ''}
          onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value;
            set({ save: v === '' ? null : (v as Trap['save']) });
          }}
        >
          <option value="">None</option>
          {SAVES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label class="field">
        <span>Effect</span>
        <select
          value={effect.kind}
          onChange={(e) => {
            const kind = (e.target as HTMLSelectElement).value as Trap['effect']['kind'];
            const firstDisease = data.content.ailments.diseases[0]?.id ?? '';
            set({
              effect:
                kind === 'damage'
                  ? { kind, dice: { count: 1, sides: 6, modifier: 0 } }
                  : kind === 'disease'
                    ? { kind, disease: firstDisease }
                    : { kind },
            });
          }}
        >
          <option value="damage">Damage</option>
          <option value="poison">Poison (half maximum HP, lingers)</option>
          <option value="disease">Disease (passes it on)</option>
          <option value="alarm">Alarm (calls the wanderers)</option>
        </select>
      </label>
      {effect.kind === 'disease' && (
        <label class="field">
          <span>Disease</span>
          <select
            value={effect.disease}
            onChange={(e) =>
              set({ effect: { kind: 'disease', disease: (e.target as HTMLSelectElement).value } })
            }
          >
            {data.content.ailments.diseases.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {effect.kind === 'damage' && (
        <div class="dice">
          <NumberField
            label="Dice"
            value={effect.dice.count}
            min={1}
            onChange={(count) => set({ effect: { ...effect, dice: { ...effect.dice, count } } })}
          />
          <NumberField
            label="Sides"
            value={effect.dice.sides}
            min={2}
            onChange={(sides) => set({ effect: { ...effect, dice: { ...effect.dice, sides } } })}
          />
          <NumberField
            label="Bonus"
            value={effect.dice.modifier}
            min={0}
            onChange={(modifier) =>
              set({ effect: { ...effect, dice: { ...effect.dice, modifier } } })
            }
          />
        </div>
      )}
    </fieldset>
  );
}
