import { DEFAULT_PRESETS, type DefaultPreset } from '../../data/schemas/index.ts';
import type { Command } from '../../game/combat/commands.ts';
import { PRESET_NAMES } from '../../game/combat/defaults.ts';
import type { Action } from '../../game/combat/types.ts';
import { useKeys } from '../keys.ts';
import { KeyHelp } from '../world/KeyHelp.tsx';
import { FIGHT_KEYS } from '../../render/key-help.ts';

interface CommandMenuProps {
  actorName: string;
  commands: Command[];
  selected: string | null;
  preset: DefaultPreset;
  onSelect: (key: string | null) => void;
  onChoose: (action: Action) => void;
  /** The odds of an attack, shown under its target (src/render/fight-odds.ts). */
  odds?: (action: Action) => string | null;
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

/** Number keys 1 to 9 for the first nine buttons of a list. */
const NUMBER_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** The number key beside a button, kept out of its accessible name. */
function KeyHint(props: { index: number }) {
  const key = NUMBER_KEYS[props.index];
  return key ? (
    <kbd class="key-hint" aria-hidden="true">
      {key}
    </kbd>
  ) : null;
}

/**
 * The acting combatant's commands, then the choices of the one picked. The keyboard plays it too:
 * the number keys pick the first nine commands or choices, Backspace goes back, and D takes the
 * default action.
 */
export function CommandMenu(props: CommandMenuProps) {
  const current = props.commands.find((c) => c.key === props.selected);
  const pick = (c: Command) => {
    const only = c.choices[0];
    if (c.choices.length === 1 && only && only.targetId === undefined && only.label === c.label)
      props.onChoose(only.action);
    else props.onSelect(c.key);
  };
  const numbered: (() => void)[] = current
    ? current.choices.map((ch) => () => props.onChoose(ch.action))
    : props.commands.map((c) => () => pick(c));
  useKeys({
    ...Object.fromEntries(NUMBER_KEYS.map((k, i) => [k, numbered[i]])),
    Backspace: current ? () => props.onSelect(null) : undefined,
    d: props.onDefault,
  });
  return (
    <section class="commands" aria-label="Commands">
      <div class="log-head">
        <h3>{props.actorName}’s turn</h3>
        <KeyHelp rows={FIGHT_KEYS} />
      </div>
      <div class="default-row">
        <button type="button" aria-keyshortcuts="D" onClick={props.onDefault}>
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
            {current.label}: choose{' '}
            {current.group === 'move'
              ? 'a slot'
              : current.group === 'gear'
                ? 'an item'
                : current.key === 'hold'
                  ? 'whose turn to wait for'
                  : 'a target'}
          </p>
          {current.choices.map((ch, i) => {
            const odds = props.odds?.(ch.action);
            return (
              <button
                key={ch.label}
                type="button"
                class={odds ? 'with-odds' : undefined}
                title={odds ?? undefined}
                aria-keyshortcuts={NUMBER_KEYS[i]}
                onClick={() => props.onChoose(ch.action)}
              >
                <KeyHint index={i} />
                {ch.label}
                {odds && <span class="odds">{odds}</span>}
              </button>
            );
          })}
          <button
            type="button"
            class="secondary"
            aria-keyshortcuts="Backspace"
            onClick={() => props.onSelect(null)}
          >
            Back
          </button>
        </div>
      ) : (
        <div class="command-list">
          {props.commands.map((c, i) => (
            <button
              key={c.key}
              type="button"
              class={`cmd ${c.group}`}
              aria-keyshortcuts={NUMBER_KEYS[i]}
              onClick={() => pick(c)}
            >
              <KeyHint index={i} />
              <span class="cmd-group">{GROUP_NAMES[c.group]}</span> {c.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
