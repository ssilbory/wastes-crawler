import { KeyActionSchema } from '../../data/schemas/index.ts';
import { ACTION_NAMES, keyLabel } from '../../render/settings-view.ts';
import { useSettings } from '../settings-store.ts';

/** The controls, with the dungeon keys as the player has them set now. */
export function HelpControls() {
  const s = useSettings();
  return (
    <details class="panel">
      <summary>
        <h2>Controls</h2>
      </summary>
      <h3>Getting around</h3>
      <p>
        The ☰ button in the corner opens every part of the game: Overland (the game itself), the
        Character builder, Arena, the Level and Map editors, Settings, Help, About, and Full screen.
        Characters, Formation, and Inventory buttons sit in the bar of every game screen.
      </p>

      <h3>Overland map</h3>
      <ul>
        <li>
          Tap or click a hex to set a destination. With a keyboard, Tab to the map, move with the
          arrow keys, and press Enter.
        </li>
        <li>
          In This quarter, choose Hike or Camp, set who does what, then press Hike for the quarter
          or Camp for the quarter to play it out.
        </li>
        <li>
          The map opens closed in on what the party knows. −, +, and Fit zoom it, Fit showing the
          whole map; so do Ctrl with the mouse wheel and a trackpad pinch. Zoomed in, drag the map
          to move about it.
        </li>
        <li>Visit, Enter, and Take buttons appear in the bar on a town, dungeon, or road.</li>
        <li>
          Keys: H plans a hike and C a camp, Q plays out the quarter, and T visits the town the
          party stands in.
        </li>
      </ul>

      <h3>Dungeons</h3>
      <p>Use the on-screen buttons, or these keys (change them in Settings):</p>
      <table class="keys">
        <tbody>
          {KeyActionSchema.options.map((action) => (
            <tr key={action}>
              <th scope="row">{ACTION_NAMES[action]}</th>
              <td>{s.keys[action].map(keyLabel).join(' or ') || 'none'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="hint">
        Search (1 turn) looks for secret doors around you; nothing is found in the dark. The map
        draws itself as you explore. Camp only on safe squares.
      </p>

      <h3>Fights</h3>
      <ul>
        <li>
          Each character's turn opens a menu of commands: Attack, Magic, Defend, Aid, Gear, Move,
          Other. Commands that need a target show the odds; pick one, or click the foe.
        </li>
        <li>
          Keys: the number beside a command or target picks it, Backspace goes back, and D takes the
          character's default action.
        </li>
        <li>
          Each character has a default action (Auto, Attack weakest, Total Defense, Repeat last
          command). Defaults for the round plays a round on them; Auto-resolve plays the fight out
          at the speed set in Settings.
        </li>
      </ul>

      <h3>Formation</h3>
      <p>
        Two rows of four. Only the front row fights in melee. Each rear slot is shielded by the slot
        ahead of it: attacks to and from the rear row have disadvantage, and the rear row has
        advantage on saves. Rearranging outside a fight is free.
      </p>

      <h3>Saves</h3>
      <p>
        The game autosaves into the slot chosen on the start screen. Export save downloads the world
        and your characters; Load a save file on the Overland start screen reads one back.
      </p>
    </details>
  );
}
