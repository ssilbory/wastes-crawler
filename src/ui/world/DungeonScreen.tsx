import { useLayoutEffect, useState } from 'preact/hooks';
import {
  exitLabel,
  levelOf,
  stairsHere,
  step,
  takeStairs,
  turnParty,
  type Step,
} from '../../game/dungeon/explore.ts';
import { describeDate } from '../../game/world/calendar.ts';
import { itemsTaken, questSteps } from '../../game/world/quests.ts';
import type { World } from '../../game/world/types.ts';
import { automap, FACING_NAMES, MAP_CELL } from '../../render/automap-view.ts';
import { dungeonView, VIEW_HEIGHT, VIEW_WIDTH } from '../../render/dungeon-view.ts';
import { data } from '../builder/data.ts';
import { PartyPanel } from './PartyPanel.tsx';
import { HealerPanel } from './HealerPanel.tsx';
import { PurgePanel } from './PurgePanel.tsx';
import { GreenwoodPanel } from './GreenwoodPanel.tsx';
import { FormsPanel } from './FormsPanel.tsx';
import { ConjunctPanel } from './ConjunctPanel.tsx';
import { NecromancyPanel } from './NecromancyPanel.tsx';
import { PactPanel } from './PactPanel.tsx';
import { SorceryPanel } from './SorceryPanel.tsx';
import { NpcPanel } from './NpcPanel.tsx';
import { QuestLog } from './QuestLog.tsx';
import { PartyButtons, type PartyScreen } from './PartyButtons.tsx';
import { JournalPanel } from './JournalPanel.tsx';
import { QuestItemNotice } from './QuestItemNotice.tsx';
import { CampPanel } from './CampPanel.tsx';
import { EncounterPanel } from './EncounterPanel.tsx';
import { blind } from '../../game/dungeon/light.ts';
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
import { play } from '../sound.ts';

type Move = { step: Step } | { turn: 'left' | 'right' | 'around' };

/** What each remappable action does here; Search is handled with the other actions. */
const MOVES: Record<Exclude<KeyAction, 'search'>, Move> = {
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
}) {
  const w = props.world;
  const s = w.dungeon as NonNullable<World['dungeon']>;
  const [bump, setBump] = useState<string | null>(null);
  const [found, setFound] = useState<ReturnType<typeof itemsTaken>>([]);
  const move = (m: Move) => {
    if (!w.dungeon) return;
    if ('step' in m) {
      const before = questSteps(w);
      const r = step(w, data, m.step);
      setBump(r.ok ? null : r.reason);
      if (r.ok) setFound(itemsTaken(w, data, before));
      play(r.ok ? 'step' : 'bump');
    } else {
      turnParty(w, data, m.turn);
      setBump(null);
    }
    props.onChange();
  };
  // Re-listened in the same commit as each render, so keys pressed between renders aren't lost.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, select, textarea')) return;
      // Keys come from the settings (docs/plan.md, Phase 11: key remapping).
      const action = actionForKey(getSettings(), e.key);
      if (!action) return;
      e.preventDefault();
      if (action === 'search') act(() => search(w, data));
      else move(MOVES[action]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
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
        <span class="date">{describeDate(data.content.overlandRules, w.day, w.quarter)}</span>
        <span>
          {level.name}, facing {FACING_NAMES[s.facing]}
        </span>
        <span class="turn">{turnText(w)}</span>
        <span class="light">{lightText(w)}</span>
        <PartyButtons onOpen={props.onOpen} />
      </div>
      <div class="world-main">
        <div class="world-left">
          <div class="dungeon-main">
            <svg
              class={blind(w, data) ? 'dungeon-view dark' : 'dungeon-view'}
              viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
              role="img"
              aria-label="Dungeon view"
            >
              <rect class="ceiling" width={VIEW_WIDTH} height={VIEW_HEIGHT / 2} />
              <rect class="floor" y={VIEW_HEIGHT / 2} width={VIEW_WIDTH} height={VIEW_HEIGHT / 2} />
              {dungeonView(w, data).map((p) => (
                <g key={p.key} class={`panel-${p.kind}`}>
                  <polygon points={p.points} fill={p.fill} />
                  {p.frame && <polygon class="door-frame" points={p.frame} />}
                </g>
              ))}
              {blind(w, data) && (
                <text class="pitch-dark" x={VIEW_WIDTH / 2} y={VIEW_HEIGHT / 2}>
                  Pitch dark
                </text>
              )}
            </svg>
            <QuestItemNotice found={found} onDismiss={() => setFound([])} />
            <EncounterPanel
              world={w}
              onFight={props.onFight}
              onLeave={props.onLeave}
              onChange={props.onChange}
            />
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
                  <button key={m.id} type="button" onClick={() => act(() => burrow(w, data, m.id))}>
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
                    <button type="button" onClick={() => act(() => step(w, data, 'forward', true))}>
                      Step onto the {trap.name}
                    </button>
                  </>
                )}
              </div>
            )}
            {stairsLabel && !w.encounter && (
              <button
                type="button"
                onClick={() => {
                  const before = questSteps(w);
                  takeStairs(w, data);
                  setBump(null);
                  setFound(itemsTaken(w, data, before));
                  props.onChange();
                }}
              >
                {stairsLabel}
              </button>
            )}
          </div>
          <QuestLog world={w} onChange={props.onChange} />
          <JournalPanel world={w} />
        </div>
        <div class="world-side flow">
          {map && (
            <section class="panel" aria-label="Automap">
              <h3>Map</h3>
              <svg
                class="automap"
                viewBox={`-2 -2 ${map.width + 4} ${map.height + 4}`}
                role="img"
                aria-label={`Map of ${level.name}`}
              >
                {map.cells.map((c) => (
                  <rect
                    key={c.key}
                    class={`seen ${c.kind}`}
                    x={c.x * MAP_CELL}
                    y={c.y * MAP_CELL}
                    width={MAP_CELL}
                    height={MAP_CELL}
                  />
                ))}
                {map.lines.map((l) => (
                  <line key={l.key} class={l.kind} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
                ))}
                {map.sensed.map((c) => (
                  <circle
                    key={c.key}
                    class="sensed"
                    cx={(c.x + 0.5) * MAP_CELL}
                    cy={(c.y + 0.5) * MAP_CELL}
                    r={MAP_CELL * 0.25}
                  >
                    <title>A working of magic</title>
                  </circle>
                ))}
                <polygon class="party" points={map.party} />
              </svg>
            </section>
          )}
          {!w.encounter && onSafeSquare(w, data) && (
            <CampPanel world={w} onChange={props.onChange} />
          )}
          <PartyPanel members={w.members} />
          <NpcPanel world={w} onChange={props.onChange} />
          <NecromancyPanel world={w} onChange={props.onChange} />
          <GreenwoodPanel world={w} onChange={props.onChange} />
          <FormsPanel world={w} onChange={props.onChange} />
          <ConjunctPanel world={w} onChange={props.onChange} />
          <SorceryPanel world={w} onChange={props.onChange} />
          <PactPanel world={w} onChange={props.onChange} />
          <HealerPanel world={w} onChange={props.onChange} />
          <PurgePanel world={w} onChange={props.onChange} />
        </div>
      </div>
    </div>
  );
}
