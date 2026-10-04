import { DEFAULT_PRESETS, type DefaultPreset } from '../../data/schemas/index.ts';
import type { Command } from '../../game/combat/commands.ts';
import { PRESET_NAMES } from '../../game/combat/defaults.ts';
import type { Action } from '../../game/combat/types.ts';

interface CommandMenuProps {
  actorName: string;
  commands: Command[];
  selected: string | null;
  preset: DefaultPreset;
  onSelect: (key: string | null) => void;
  onChoose: (action: Action) => void;
  onPreset: (preset: DefaultPreset) => void;
  onDefault: () => void;
}

const GROUP_NAMES: Record<Command['group'], string> = {
  attack: 'Attack',
  magic: 'Magic',
  defend: 'Defend',
  aid: 'Aid',
  gear: 'Gear',
  move: 'Move',
  wait: 'Other',
};

export function CommandMenu(props: CommandMenuProps) {
  const current = props.commands.find((c) => c.key === props.selected);
  const pick = (c: Command) => {
    const only = c.choices[0];
    if (c.choices.length === 1 && only && only.targetId === undefined && only.label === c.label)
      props.onChoose(only.action);
    else props.onSelect(c.key);
  };
  return (
    <section class="commands" aria-label="Commands">
      <h3>{props.actorName}’s turn</h3>
      <div class="default-row">
        <button type="button" onClick={props.onDefault}>
          Default: {PRESET_NAMES[props.preset]}
        </button>
        <label>
          Default action{' '}
          <select
            value={props.preset}
            onChange={(e) => props.onPreset((e.target as HTMLSelectElement).value as DefaultPreset)}
          >
            {DEFAULT_PRESETS.map((p) => (
              <option key={p} value={p}>
                {PRESET_NAMES[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {current ? (
        <div class="choices">
          <p>
            {current.label}: choose {current.group === 'move' ? 'a slot' : 'a target'}
          </p>
          {current.choices.map((ch) => (
            <button key={ch.label} type="button" onClick={() => props.onChoose(ch.action)}>
              {ch.label}
            </button>
          ))}
          <button type="button" class="secondary" onClick={() => props.onSelect(null)}>
            Back
          </button>
        </div>
      ) : (
        <div class="command-list">
          {props.commands.map((c) => (
            <button key={c.key} type="button" class={`cmd ${c.group}`} onClick={() => pick(c)}>
              <span class="cmd-group">{GROUP_NAMES[c.group]}</span> {c.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
