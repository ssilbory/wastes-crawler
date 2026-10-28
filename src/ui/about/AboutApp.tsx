import { useEffect } from 'preact/hooks';
import notice from '../../../NOTICE?raw';
import { noticeParagraphs, SHIPPED, storageNote } from '../../render/about-view.ts';
import { fullscreenAvailable, toggleFullscreen, useFullscreen } from '../fullscreen.ts';
import { installed, SAVES_LINK, useInstall, usePersisted } from '../pwa.ts';
import './about.css';

/** About: what the game is, how to install it on a phone, where saves live, and the credits. */
export function AboutApp() {
  const install = useInstall();
  const fullscreen = useFullscreen();
  const [persisted, keepSaves] = usePersisted();
  useEffect(() => {
    if (location.hash === SAVES_LINK) document.getElementById('saves')?.scrollIntoView();
  }, []);
  return (
    <main class="about">
      <h1>About</h1>
      <section class="panel" aria-label="The game">
        <h2>Wastes Crawler</h2>
        <p>
          A party-based dungeon crawler and wilderness game on the Worlds Without Number rules.
          Build a party, cross the Dark Lands a quarter day at a time, and go down into its ruins.
        </p>
        <p class="hint">A hobby project: free, with no accounts, ads, or tracking.</p>
      </section>

      <section class="panel" aria-label="Why this game">
        <h2>Why this game</h2>
        <p>
          This is the game I imagined The Bard's Tale and Wizardry were like when I was a child. I
          never got to play them: I lacked the hardware and the parental permission.
        </p>
        <p>
          It is also a love letter to the OSR, and to games with the OSR feel like Worlds Without
          Number and Forbidden Lands. I wish I could find players for them. The game's chassis is
          bent and borrowed from the Worlds Without Number and Cities Without Number SRDs, and many
          of its monsters are inspired by classic OSR monsters.
        </p>
      </section>

      <section class="panel" aria-label="If you like this game">
        <h2>If you like this game</h2>
        <dl class="recommend">
          <dt>The games that started it</dt>
          <dd>
            Wizardry: Proving Grounds of the Mad Overlord is excellent on Steam. Wizardry Variants
            Daphne is too, on Steam and Android, and possibly iPhone. The Bard's Tale Trilogy is on
            Steam.
          </dd>
          <dt>To play with friends</dt>
          <dd>
            Try Stars, Worlds, Cities, and Ashes Without Number, a series of excellent OSR games by
            Kevin Crawford of Sine Nomine Publishing, one of my favorite designers. I look forward
            to the Kickstarter for the next one, or maybe a Stars Without Number update.
          </dd>
          <dt>The feel on a more modern chassis</dt>
          <dd>
            Free League's Forbidden Lands is an excellent OSR-themed hex crawl. Their Dragonbane and
            Symbaroum are worth a look as well.
          </dd>
        </dl>
      </section>

      <section class="panel" aria-label="Play anywhere">
        <h2>Play on a phone or offline</h2>
        {installed() ? (
          <p>You are playing the installed game. It runs with no connection.</p>
        ) : (
          <>
            <p>
              The game installs like an app: it gets a home screen icon, opens full screen, and runs
              with no connection after the first visit.
            </p>
            {install && (
              <p>
                <button type="button" class="create" onClick={() => void install()}>
                  Install Wastes Crawler
                </button>
              </p>
            )}
            <dl class="install-steps">
              <dt>Android (Chrome)</dt>
              <dd>Menu ⋮, then Install app (or Add to Home screen).</dd>
              <dt>iPhone and iPad (Safari)</dt>
              <dd>Share, then Add to Home Screen.</dd>
              <dt>Computer (Chrome or Edge)</dt>
              <dd>The install icon at the right of the address bar.</dd>
            </dl>
          </>
        )}
        {fullscreenAvailable() && (
          <p>
            <button type="button" onClick={() => void toggleFullscreen()}>
              {fullscreen ? 'Leave full screen' : 'Full screen'}
            </button>{' '}
            <span class="hint">Also in the ☰ menu.</span>
          </p>
        )}
      </section>

      <section class="panel" id="saves" aria-label="Your saves">
        <h2>Your saves</h2>
        <p>
          Saves live in this browser, on this device only. To move a game to another device, use
          Export save on the map, then Load a save file on the other device.
        </p>
        <p class="hint">{storageNote(persisted)}</p>
        {persisted === false && (
          <p>
            <button type="button" onClick={keepSaves}>
              Ask to keep my saves
            </button>
          </p>
        )}
      </section>

      <section class="panel" aria-label="Credits">
        <h2>Credits</h2>
        {noticeParagraphs(notice).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>

      <section class="panel" aria-label="Software">
        <h2>Software</h2>
        <table>
          <tbody>
            {SHIPPED.map((d) => (
              <tr key={d.name}>
                <th scope="row">{d.what}</th>
                <td>{d.name}</td>
                <td>{d.license}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
