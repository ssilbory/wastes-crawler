import { useState } from 'preact/hooks';
import type { World } from '../../game/world/types.ts';
import { describeDate } from '../../game/world/calendar.ts';
import { route, setDestination, suggestPlan } from '../../game/world/plans.ts';
import { regionMap } from '../../game/world/region.ts';
import { hexKey } from '../../rules/hex.ts';
import { hexCells, mapPixels } from '../../render/hex-view.ts';
import { crowns, lootText } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import { HEX_SIZE, HexMap } from './HexMap.tsx';
import { PartyPanel } from './PartyPanel.tsx';
import { EncounterPanel } from './EncounterPanel.tsx';
import { NpcPanel } from './NpcPanel.tsx';
import { CoachPanel } from './CoachPanel.tsx';
import { QuarterPanel } from './QuarterPanel.tsx';
import { typeOf } from '../../game/world/npcs.ts';
import type { QuarterPlan } from '../../game/world/types.ts';

export function MapScreen(props: {
  world: World;
  version: number;
  onChange: () => void;
  onPass: (plan: QuarterPlan) => void;
  onFight: () => void;
  onLeave: () => void;
  onTown: () => void;
  onRide: () => void;
  onExport: () => void;
  onAbandon: () => void;
}) {
  const w = props.world;
  const map = regionMap(data, w.region);
  const [plan, setPlan] = useState<{ version: number; plan: QuarterPlan } | null>(null);
  const current = plan?.version === props.version ? plan.plan : suggestPlan(w, data);
  const choose = (p: QuarterPlan) => setPlan({ version: props.version, plan: p });
  const able = w.members.filter((m) => !m.dead && m.character.hp.current > 0);
  const { width, height } = mapPixels(map, HEX_SIZE);
  const town = map.siteAt(w.position);
  const here = town?.name ?? map.terrainAt(w.position).name;
  return (
    <div class="world">
      <div class="world-bar">
        <span class="date">{describeDate(data.content.overlandRules, w.day, w.quarter)}</span>
        <span>
          {here} ({hexKey(w.position)})
        </span>
        <span>Rations: {w.rations === 0 ? 'none' : `d${w.rations}`}</span>
        <span>Purse: {crowns(w.purse)}</span>
        <span>Loot: {lootText(w.loot)}</span>
        {town && !w.encounter && !w.coach && (
          <button type="button" onClick={props.onTown}>
            Visit {town.name}
          </button>
        )}
        <button type="button" class="secondary" onClick={props.onExport}>
          Export save
        </button>
        <button type="button" class="secondary" onClick={props.onAbandon}>
          Abandon world
        </button>
      </div>
      <div class="world-main">
        <div class="map-wrap">
          <HexMap
            cells={hexCells(map, w, route(w, data), HEX_SIZE)}
            width={width}
            height={height}
            onPick={(col, row) => {
              if (!w.encounter && !w.coach && setDestination(w, data, { col, row }))
                props.onChange();
            }}
          />
        </div>
        <div class="world-side">
          {w.encounter ? (
            <EncounterPanel
              world={w}
              onFight={props.onFight}
              onLeave={props.onLeave}
              onChange={props.onChange}
            />
          ) : w.coach ? (
            <CoachPanel world={w} onRide={props.onRide} />
          ) : (
            <QuarterPanel
              members={able}
              guides={w.npcs
                .filter((n) => n.hp > 0 && typeOf(data, n)?.role === 'guide')
                .map((n) => ({ id: n.id, name: n.name }))}
              plan={current}
              canHike={w.destination !== null}
              onPlan={choose}
              onHike={() => choose(suggestPlan(w, data, 'hike'))}
              onCamp={() => choose(suggestPlan(w, data, 'camp'))}
              onPass={() => props.onPass(current)}
            />
          )}
          <PartyPanel members={w.members} />
          <NpcPanel world={w} onChange={props.onChange} />
          <section class="panel log" aria-label="Journey log">
            <h3>Journal</h3>
            <ol>
              {w.log.slice(-60).map((line, i) => (
                <li key={`${i}-${line}`}>{line}</li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
