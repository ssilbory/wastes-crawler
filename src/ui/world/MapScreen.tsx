import { foundSitesIn } from '../../game/world/hidden-sites.ts';
import { useMemo, useState } from 'preact/hooks';
import type { World } from '../../game/world/types.ts';
import { describeDate } from '../../game/world/calendar.ts';
import { route, setDestination, suggestPlan } from '../../game/world/plans.ts';
import { regionMap } from '../../game/world/region.ts';
import { hexKey } from '../../rules/hex.ts';
import { hexCells, mapPixels } from '../../render/hex-view.ts';
import { crowns, lootText } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import { ConfirmButton } from '../confirm.tsx';
import { HEX_SIZE, HexMap } from './HexMap.tsx';
import { ZoomFrame } from './ZoomFrame.tsx';
import { knownBounds } from '../../render/map-zoom.ts';
import { dayTint } from '../../render/hex-art.ts';
import { PartyPanel } from './PartyPanel.tsx';
import { EncounterPanel } from './EncounterPanel.tsx';
import { FactionsPanel } from './FactionsPanel.tsx';
import { WarlordsPanel } from './WarlordsPanel.tsx';
import { SettingPanel } from './SettingPanel.tsx';
import { HealerPanel } from './HealerPanel.tsx';
import { PurgePanel } from './PurgePanel.tsx';
import { AntidotePanel } from './AntidotePanel.tsx';
import { PotionPanel } from './PotionPanel.tsx';
import { GreenwoodPanel } from './GreenwoodPanel.tsx';
import { CompanionsPanel } from './CompanionsPanel.tsx';
import { FormsPanel } from './FormsPanel.tsx';
import { ConjunctPanel } from './ConjunctPanel.tsx';
import { HighRoadPanel } from './HighRoadPanel.tsx';
import { PactPanel } from './PactPanel.tsx';
import { SorceryPanel } from './SorceryPanel.tsx';
import { NecromancyPanel } from './NecromancyPanel.tsx';
import { MountsPanel } from './MountsPanel.tsx';
import { NpcPanel } from './NpcPanel.tsx';
import { PopOut } from './PopOut.tsx';
import { BarMore } from './BarMore.tsx';
import { useKeys } from '../keys.ts';
import { openQuests, QuestLog } from './QuestLog.tsx';
import { PartyButtons, type PartyScreen } from './PartyButtons.tsx';
import { JournalPanel } from './JournalPanel.tsx';
import { captiveHomes, questTargets, revealedHexes } from '../../render/quest-view.ts';
import { CoachPanel } from './CoachPanel.tsx';
import { QuarterPanel } from './QuarterPanel.tsx';
import { typeOf } from '../../game/world/npcs.ts';
import { entrancesIn, wayDownHere } from '../../game/dungeon/ruins.ts';
import type { QuarterPlan } from '../../game/world/types.ts';
import { grovesHere } from '../../game/world/groves.ts';

export function MapScreen(props: {
  world: World;
  version: number;
  onChange: () => void;
  onPass: (plan: QuarterPlan) => void;
  onFight: () => void;
  onLeave: () => void;
  onTown: () => void;
  onOpen: (screen: PartyScreen) => void;
  onRide: () => void;
  onEnter: () => void;
  onCross: () => void;
  onExport: () => void;
  onAbandon: () => void;
}) {
  const w = props.world;
  const map = regionMap(data, w.region);
  const [plan, setPlan] = useState<{ version: number; plan: QuarterPlan } | null>(null);
  const current = plan?.version === props.version ? plan.plan : suggestPlan(w, data);
  const choose = (p: QuarterPlan) => setPlan({ version: props.version, plan: p });
  const able = w.members.filter((m) => !m.dead && m.character.hp.current > 0);
  const hike = () => choose(suggestPlan(w, data, 'hike'));
  const camp = () => choose(suggestPlan(w, data, 'camp'));
  const { width, height } = mapPixels(map, HEX_SIZE);
  const found = foundSitesIn(w, data, w.region);
  // Ruins found by exploring are ways down like any other.
  const entrances = [
    ...entrancesIn(data, w.region, w.rumors),
    ...found.filter((s) => s.kind === 'ruin'),
  ];
  // The hexes change only with the world, so picking a plan or zooming reuses them.
  const cells = useMemo(
    () =>
      hexCells(
        map,
        w,
        route(w, data),
        HEX_SIZE,
        // A freed captive's home is marked like a quest's goal, and shows through the fog.
        [...questTargets(w, data), ...captiveHomes(w, data)],
        entrances,
        grovesHere(w, data),
        revealedHexes(w, data),
        found.filter((s) => s.kind === 'lair'),
      ),
    [w, props.version],
  );
  // Zooming in from the whole map closes in on the party.
  const party = cells.find((c) => c.party);
  const partyFocus = party ? { x: party.cx / width, y: party.cy / height } : null;
  // It opens on what the party knows, with a few hexes of fog about it, not the whole chart.
  const known = knownBounds(cells, { width, height }, HEX_SIZE * 3);
  const town = map.siteAt(w.position);
  const here = town?.name ?? map.terrainAt(w.position).name;
  const way = wayDownHere(w, data);
  const road = map.exitAt(w.position);
  // H and C pick the plan, Q plays the quarter out, T visits the town. Space plays the quarter out
  // toward a targeted hex, hiking or camping as planned (Sam's call); with no hex targeted, it
  // visits the town or goes down the way here. Only while the quarter's plan is on show, so never
  // over an encounter or on a coach.
  const planning = !w.encounter && !w.coach;
  const pass = () => props.onPass(current);
  const targeted = w.destination !== null;
  useKeys({
    h: planning && targeted ? hike : undefined,
    c: planning ? camp : undefined,
    q: planning ? pass : undefined,
    t: planning && town ? props.onTown : undefined,
    ' ': !planning
      ? undefined
      : targeted
        ? pass
        : town
          ? props.onTown
          : way
            ? props.onEnter
            : undefined,
  });
  return (
    <div class="world map-screen">
      <div class="world-bar">
        <div class="bar-status">
          <span class="date">{describeDate(data.content.overlandRules, w.day, w.quarter)}</span>
          <span class="region">{map.name}</span>
          <span>
            {here} ({hexKey(w.position)})
          </span>
          <span>Rations: {w.rations === 0 ? 'none' : `d${w.rations}`}</span>
          <span>Water: {w.water === 0 ? 'none' : `d${w.water}`}</span>
          <span>Purse: {crowns(w.purse)}</span>
          <span>Loot: {lootText(w.loot)}</span>
        </div>
        <span class="bar-actions">
          {town && !w.encounter && !w.coach && (
            <button
              type="button"
              aria-keyshortcuts={targeted ? 'T' : 'T Space'}
              onClick={props.onTown}
            >
              Visit {town.name}
            </button>
          )}
          {way && !w.encounter && !w.coach && (
            <button
              type="button"
              aria-keyshortcuts={town || targeted ? undefined : 'Space'}
              onClick={props.onEnter}
            >
              Enter {way.name}
              {way.level !== null && ` (for level ${way.level})`}
            </button>
          )}
          {road && !w.encounter && !w.coach && (
            <button type="button" onClick={props.onCross}>
              Take {road.name}
            </button>
          )}
          <PartyButtons onOpen={props.onOpen} />
          <BarMore>
            <button type="button" class="secondary" onClick={props.onExport}>
              Export save
            </button>
            <ConfirmButton class="secondary" confirm="Delete the save" onConfirm={props.onAbandon}>
              Abandon world
            </ConfirmButton>
          </BarMore>
        </span>
      </div>
      <div class="world-main">
        <div class="world-left">
          <ZoomFrame class="map-wrap" pan focus={partyFocus} start={known} size={{ width, height }}>
            <HexMap
              cells={cells}
              width={width}
              height={height}
              tint={dayTint(w.quarter)}
              onPick={(col, row) => {
                if (!w.encounter && !w.coach && setDestination(w, data, { col, row }))
                  props.onChange();
              }}
            />
          </ZoomFrame>
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
          {w.encounter ? null : w.coach ? (
            <CoachPanel world={w} onRide={props.onRide} />
          ) : (
            <QuarterPanel
              members={able}
              guides={w.npcs
                .filter((n) => n.hp > 0 && typeOf(data, n)?.role === 'guide')
                .map((n) => ({ id: n.id, name: n.name }))}
              plan={current}
              canHike={w.destination !== null}
              noQuests={openQuests(w).length === 0}
              onPlan={choose}
              onHike={hike}
              onCamp={camp}
              onPass={pass}
              spacePlays={targeted}
            />
          )}
          {/* Quests, then the party, then the panels of powers and places (Sam's call: one column). */}
          <QuestLog world={w} onChange={props.onChange} />
          <PartyPanel members={w.members} />
          <NpcPanel world={w} onChange={props.onChange} />
          <MountsPanel world={w} onChange={props.onChange} />
          <CompanionsPanel world={w} onChange={props.onChange} />
          <SettingPanel world={w} inTown={town !== undefined} onChange={props.onChange} />
          <NecromancyPanel world={w} onChange={props.onChange} />
          <GreenwoodPanel world={w} onChange={props.onChange} />
          <FormsPanel world={w} onChange={props.onChange} />
          <ConjunctPanel world={w} onChange={props.onChange} />
          <HighRoadPanel world={w} onChange={props.onChange} />
          <SorceryPanel world={w} onChange={props.onChange} />
          <PactPanel world={w} onChange={props.onChange} />
          <HealerPanel world={w} onChange={props.onChange} />
          <PurgePanel world={w} onChange={props.onChange} />
          <AntidotePanel world={w} onChange={props.onChange} />
          <PotionPanel world={w} onChange={props.onChange} />
          <FactionsPanel world={w} />
          <WarlordsPanel world={w} />
        </div>
      </div>
    </div>
  );
}
