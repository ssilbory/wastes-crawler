import { slotSummary } from '../../render/save-view.ts';
import { data } from '../builder/data.ts';
import { ConfirmButton } from '../confirm.tsx';
import { activeSlot, loadWorldText } from '../storage.ts';
import { launchHash } from '../world/launch.ts';
import './title.css';

const go = (hash: string) => {
  location.hash = hash;
};

/** The first screen: continue the journey, set out with the starter party, or make a character. */
export function TitleApp() {
  const slot = activeSlot();
  const saved = loadWorldText(slot);
  return (
    <div class="arena intro">
      <main class="intro-text title-card">
        <h1>Wastes Crawler</h1>
        <p class="hint">
          A party-based dungeon crawler on the Worlds Without Number rules, twenty years after the
          Dark Lord vanished.
        </p>
        <nav class="title-actions" aria-label="Start">
          {saved !== null && (
            <button type="button" class="create" onClick={() => go(launchHash('continue'))}>
              Continue journey
              <span class="title-sub">
                Slot {slot}: {slotSummary(saved, data)}
              </span>
            </button>
          )}
          <ConfirmButton
            class={saved === null ? 'create' : undefined}
            ask={saved !== null}
            confirm={`Replace slot ${slot}`}
            onConfirm={() => go(launchHash('starters'))}
          >
            New journey with the starter party
            <span class="title-sub">
              {data.content.starterParty.length} ready-made characters, straight onto the campaign
            </span>
          </ConfirmButton>
          <a class="title-link" href="#/builder">
            Make your own characters
          </a>
          <a class="title-link" href="#/world">
            More ways to start: save slots, realms, custom maps, save files
          </a>
        </nav>
        <p class="title-more">
          <a href="#/help">Help</a> · <a href="#/arena">Arena</a> ·{' '}
          <a href="#/settings">Settings</a> · <a href="#/about">About</a>
        </p>
      </main>
    </div>
  );
}
