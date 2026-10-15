import '../about/about.css';
import './help.css';
import { HelpControls } from './HelpControls.tsx';
import { HelpGameplay } from './HelpGameplay.tsx';

/** Help: how to play, the controls, and what to do when the game is too hard. */
export function HelpApp() {
  return (
    <main class="about help">
      <h1>Help</h1>

      <details class="panel" open>
        <summary>
          <h2>The game is too hard</h2>
        </summary>
        <p>Yes. It is designed that way, because that's how I play it. Some ways to soften it:</p>
        <ul>
          <li>
            Export a character from the character builder (Export JSON), edit their stats in the
            file (3 to 18), and import it again.
          </li>
          <li>
            In the builder, choose Roll 3d6 in order. After your three free rerolls, pressing Reroll
            once more lets you just set the stats you want.
          </li>
          <li>
            Open the Level editor and the Map editor (☰ menu) to look at the dungeons and maps
            you'll meet, or change them.
          </li>
          <li>Take a couple of casters, including a healer.</li>
          <li>
            Train several people in Heal: Training tab in town, Assign skill points, Raise Heal.
          </li>
          <li>Give your spellcasters the Die Hard and Armored Magic foci.</li>
          <li>
            Bring a necromancer: Raise Corpse animates the dead, and Query the Skull lets you
            question corpses after a fight.
          </li>
          <li>
            Bring a ranger and bind a beast companion (Bind Companion), or win over a beast with
            someone trained in Animal Ken.
          </li>
          <li>
            Spells can save PCs from death (Prudentially Transient Abnegation of Life, The Long
            Amber Moment, Forgetting the Grave), dig through walls (The Burrower Below, Decree of
            Lithic Dissolution), and more. Read the last line of a spell's description, the one
            starting "In game:", for how it works here: hover over the spell's name, or tap the ⓘ
            beside it on a phone.
          </li>
          <li>
            Frailty sticks until it's removed. Someone with an okay Pray skill can pray in a town
            with a temple (Inn and healer tab) to lift it. Each member can pray once a day, so stay
            a night at the Inn, or go camp for a day, and pray again. The healer's Cure Frailty
            costs 100 crowns.
          </li>
        </ul>
      </details>

      <details class="panel" open>
        <summary>
          <h2>But isn't that cheating?</h2>
        </summary>
        <p>It's a game. It should be fun to play. Play however feels fun to you.</p>
      </details>

      <HelpControls />
      <HelpGameplay />
    </main>
  );
}
