import { useLayoutEffect, useState } from 'preact/hooks';
import {
  exitLabel,
  levelOf,
  stairsHere,
  step,
  takeStairs,
  turnParty,
} from '../../game/dungeon/explore.ts';
import { describeDate } from '../../game/world/calendar.ts';
import type { World } from '../../game/world/types.ts';
import { automap, FACING_NAMES } from '../../render/automap-view.ts';
import { Automap } from './Automap.tsx';
import { dungeonView } from '../../render/dungeon-view.ts';
import { lightView } from '../../render/dungeon-light.ts';
import { DungeonView } from './DungeonView.tsx';
import { encounterPortrait } from '../../render/encounter-portrait.ts';
import { motionOf, type Motion, type PartyMove as Move } from '../../render/dungeon-motion.ts';
import { data } from '../builder/data.ts';
import { PartyPanel } from './PartyPanel.tsx';
import { HealerPanel } from './HealerPanel.tsx';
import { PurgePanel } from './PurgePanel.tsx';
import { AntidotePanel } from './AntidotePanel.tsx';
import { PotionPanel } from './PotionPanel.tsx';
import { GreenwoodPanel } from './GreenwoodPanel.tsx';
import { CompanionsPanel } from './CompanionsPanel.tsx';
import { FormsPanel } from './FormsPanel.tsx';
import { ConjunctPanel } from './ConjunctPanel.tsx';
import { NecromancyPanel } from './NecromancyPanel.tsx';
import { PactPanel } from './PactPanel.tsx';
import { SorceryPanel } from './SorceryPanel.tsx';
import { NpcPanel } from './NpcPanel.tsx';
import { QuestLog } from './QuestLog.tsx';
import { PartyButtons, type PartyScreen } from './PartyButtons.tsx';
import { JournalPanel } from './JournalPanel.tsx';
import { PopOut } from './PopOut.tsx';
import { BarMore } from './BarMore.tsx';
import { CampPanel } from './CampPanel.tsx';
import { EncounterPanel } from './EncounterPanel.tsx';
import { onSafeSquare } from '../../game/dungeon/time.ts';
import { search } from '../../game/dungeon/secrets.ts';
import { burrow, burrowers } from '../../game/dungeon/burrow.ts';
import { castersOf, SIGIL, sigilEscape } from '../../game/world/waygates.ts';
import { disarm, knownTrapAhead } from '../../game/dungeon/traps.ts';
import type { TownResult } from '../../game/world/services.ts';
import { lightText, turnText } from '../../render/light-view.ts';

import type { KeyAction } from '../../data/schemas/index.ts';
import { actionForKey } from '../../game/settings.ts';
import { getSettings } from '../settings-store.ts';
import { isShortcut } from '../keys.ts';
import { keyLabel } from '../../render/settings-view.ts';
import { play } from '../sound.ts';

/** What each remappable move does here; Search and the stairs are handled on their own. */
const MOVES: Record<Exclude<KeyAction, 'search' | 'stairs'>, Move> = {
  forward: { step: 'forward' },
  back: { step: 'back' },
  'turn-left': { turn: 'left' },
  'turn-right': { turn: 'right' },
  'step-left': { step: 'left' },
  'step-right': { step: 'right' },
};

/** First-person view, automap, and controls while the party is underground. */
export function DungeonScreen(props: {
  world: World;
  version: number;
  onChange: () => void;
  onFight: () => void;
  onLeave: () => void;
  onOpen: (screen: PartyScreen) => void;
  onExport: () => void;
}) {
  const w = props.world;
  const s = w.dungeon as NonNullable<World['dungeon']>;
  const [bump, setBump] = useState<string | null>(null);
  // The view's motion after each move, numbered so the same motion twice plays twice.
  const [motion, setMotion] = useState<{ kind: Motion; n: number } | null>(null);
  const move = (m: Move) => {
    if (!w.dungeon) return;
    const r = 'step' in m ? step(w, data, m.step) : turnParty(w, data, m.turn);
    setBump(r.ok ? null : r.reason);
    if ('step' in m) play(r.ok ? 'step' : 'bump');
    setMotion({ kind: motionOf(m, r.ok), n: (motion?.n ?? 0) + 1 });
    props.onChange();
  };
  // Re-listened in the same commit as each render, so keys pressed between renders aren't lost.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Keys come from the settings (docs/plan.md, Phase 11: key remapping).
      const action = isShortcut(e) ? actionForKey(getSettings(), e.key) : null;
      if (!action) return;
      e.preventDefault();
      if (action === 'stairs') {
        if (stairsLabel && !w.encounter) climb();
      } else if (action === 'search') act(() => search(w, data));
      else move(MOVES[action]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const climb = () => {
    takeStairs(w, data);
    setBump(null);
    props.onChange();
  };
  /** The keys bound to an action, for screen readers, as aria-keyshortcuts names them. */
  const keysFor = (action: KeyAction) =>
    getSettings()
      .keys[action].map((k) => (k === ' ' ? 'Space' : keyLabel(k)))
      .join(' ') || undefined;
  /** Runs an action and shows why it was refused, if it was. */
  const act = (action: () => TownResult) => {
    const r = action();
    setBump(r.ok ? null : r.reason);
    props.onChange();
  };
  const trap = knownTrapAhead(w, data);
  const { level } = levelOf(data, s.dungeon, s.level);
  const stairs = stairsHere(w, data);
  const map = automap(w, data);
  const stairsLabel = !stairs
    ? null
    : 'surface' in stairs.to
      ? exitLabel(data, s.dungeon)
      : `Take the stairs to ${levelOf(data, s.dungeon, stairs.to.level).level.name}`;
  return (
    <div class="world dungeon">
      <div class="world-bar">
        <div class="bar-status">
          <span class="date">{describeDate(data.content.overlandRules, w.day, w.quarter)}</span>
          <span>
            {level.name}, facing {FACING_NAMES[s.facing]}
          </span>
          <span class="turn">{turnText(w)}</span>
          <span class="light">{lightText(w)}</span>
          <span>Rations: {w.rations === 0 ? 'none' : `d${w.rations}`}</span>
        </div>
        <span class="bar-actions">
          <PartyButtons onOpen={props.onOpen} />
          <BarMore>
            <button type="button" class="secondary" onClick={props.onExport}>
              Export save
            </button>
          </BarMore>
        </span>
      </div>
      <div class="world-main">
        <div class="world-left">
          <div class="dungeon-main">
            <DungeonView
              motion={motion?.kind ?? null}
              moves={motion?.n ?? 0}
              foes={w.encounter ? encounterPortrait(data, w.encounter.enemies) : []}
              panels={dungeonView(w, data)}
              light={lightView(w, data)}
              label="Dungeon view"
            />
            <div class="dungeon-controls">
              <p class="bump" aria-live="polite">
                {bump ?? ' '}
              </p>
              <div class="moves" role="group" aria-label="Move">
                <button type="button" onClick={() => move({ step: 'left' })}>
                  Step left
                </button>
                <button type="button" onClick={() => move({ step: 'forward' })}>
                  Forward
                </button>
                <button type="button" onClick={() => move({ step: 'right' })}>
                  Step right
                </button>
                <button type="button" onClick={() => move({ turn: 'left' })}>
                  Turn left
                </button>
                <button type="button" onClick={() => move({ step: 'back' })}>
                  Back
                </button>
                <button type="button" onClick={() => move({ turn: 'right' })}>
                  Turn right
                </button>
              </div>
              {!w.encounter && (
                <div class="actions" role="group" aria-label="Explore">
                  <button type="button" onClick={() => act(() => search(w, data))}>
                    Search (1 turn)
                  </button>
                  {burrowers(w).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => act(() => burrow(w, data, m.id))}
                    >
                      {m.character.name}: dig through the wall ahead (1 turn)
                    </button>
                  ))}
                  {castersOf(w, SIGIL).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => act(() => sigilEscape(w, data, m.id))}
                    >
                      {m.character.name}: escape to the surface with the Ochre Sigil
                    </button>
                  ))}
                  {trap && (
                    <>
                      <button type="button" onClick={() => act(() => disarm(w, data))}>
                        Disarm the {trap.name} (1 turn)
                      </button>
                      <button
                        type="button"
                        onClick={() => act(() => step(w, data, 'forward', true))}
                      >
                        Step onto the {trap.name}
                      </button>
                    </>
                  )}
                </div>
              )}
              {stairsLabel && !w.encounter && (
                <button type="button" aria-keyshortcuts={keysFor('stairs')} onClick={climb}>
                  {stairsLabel}
                </button>
              )}
            </div>
          </div>
          <JournalPanel world={w} />
          {w.encounter && (
            <PopOut label="Encounter">
              <EncounterPanel
                world={w}
                onFight={props.onFight}
                onLeave={props.onLeave}
                onChange={props.onChange}
              />
            </PopOut>
          )}
        </div>
        <div class="dock">
          {map && (
            <section class="panel" aria-label="Automap">
              <h3>Map</h3>
              <Automap map={map} label={`Map of ${level.name}`} />
            </section>
          )}
          {!w.encounter && onSafeSquare(w, data) && (
            <CampPanel world={w} onChange={props.onChange} />
          )}
          {/* Quests, then the party, then the panels of powers (Sam's call: one column). */}
          <QuestLog world={w} onChange={props.onChange} />
          <PartyPanel members={w.members} />
          <NpcPanel world={w} onChange={props.onChange} />
          <CompanionsPanel world={w} onChange={props.onChange} />
          <NecromancyPanel world={w} onChange={props.onChange} />
          <GreenwoodPanel world={w} onChange={props.onChange} />
          <FormsPanel world={w} onChange={props.onChange} />
          <ConjunctPanel world={w} onChange={props.onChange} />
          <SorceryPanel world={w} onChange={props.onChange} />
          <PactPanel world={w} onChange={props.onChange} />
          <HealerPanel world={w} onChange={props.onChange} />
          <PurgePanel world={w} onChange={props.onChange} />
          <AntidotePanel world={w} onChange={props.onChange} />
          <PotionPanel world={w} onChange={props.onChange} />
        </div>
      </div>
    </div>
  );
}
