import { useState } from 'preact/hooks';
import type { RosterEntry } from '../../game/character/roster.ts';
import type { TownResult } from '../../game/world/services.ts';
import { townHere } from '../../game/world/town.ts';
import type { World } from '../../game/world/types.ts';
import { crowns, lootText, tradeText } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import { MountsPanel } from '../world/MountsPanel.tsx';
import { CompanionsPanel } from '../world/CompanionsPanel.tsx';
import { NpcPanel } from '../world/NpcPanel.tsx';
import { QuestLog } from '../world/QuestLog.tsx';
import { PartyButtons, type PartyScreen } from '../world/PartyButtons.tsx';
import { JournalPanel } from '../world/JournalPanel.tsx';
import { FactionsPanel } from '../world/FactionsPanel.tsx';
import { SettingPanel } from '../world/SettingPanel.tsx';
import { raidedText } from '../../render/setting-view.ts';
import { PartyPanel } from '../world/PartyPanel.tsx';
import { PurgePanel } from '../world/PurgePanel.tsx';
import { AntidotePanel } from '../world/AntidotePanel.tsx';
import { QuestsTab } from './QuestsTab.tsx';
import { ServicesTab } from './ServicesTab.tsx';
import { ShopTab } from './ShopTab.tsx';
import { StableTab } from './StableTab.tsx';
import { TavernTab } from './TavernTab.tsx';
import { TrainingTab } from './TrainingTab.tsx';
import { TravelTab } from './TravelTab.tsx';
import { WorkshopTab } from './WorkshopTab.tsx';
import { CraftsmanTab } from './CraftsmanTab.tsx';
import { ArenaTab } from './ArenaTab.tsx';
import type { BoutStart } from '../../game/world/arena.ts';

const TABS = {
  quests: 'Quests',
  services: 'Inn and healer',
  shop: 'Shop',
  stable: 'Stable',
  tavern: 'Tavern',
  training: 'Training',
  workshop: 'Workshop',
  craftsman: 'Craftsman',
  travel: 'Coaches',
  arena: 'Arena',
} as const;
export type Tab = keyof typeof TABS;

/** Runs a town action and shows its refusal, or a success message when it returns one. */
export type Act = (action: () => TownResult | string) => void;

/** The town hub (docs/rules-adaptation.md, Towns in Phase 6a). */
export function TownScreen(props: {
  world: World;
  roster: RosterEntry[];
  version: number;
  onChange: () => void;
  onLeave: () => void;
  onOpen: (screen: PartyScreen) => void;
  /** The open tab, kept by the caller so it survives a trip to the party's screens. */
  tab: Tab;
  onTab: (tab: Tab) => void;
  onBout: (start: Extract<BoutStart, { ok: true }>) => void;
}) {
  const w = props.world;
  const town = townHere(w, data);
  const { tab } = props;
  const [message, setMessage] = useState<string | null>(null);
  const act: Act = (action) => {
    const r = action();
    setMessage(typeof r === 'string' ? r : r.ok ? null : r.reason);
    props.onChange();
  };
  return (
    <div class="world town">
      <div class="world-bar">
        <h1 class="date">{town.name}</h1>
        <span>Purse: {crowns(w.purse)}</span>
        <span>Loot: {lootText(w.loot)}</span>
        {raidedText(w, town.id) && <span class="raided">{raidedText(w, town.id)}</span>}
        {tradeText(w, data) && <span class="trade">{tradeText(w, data)}</span>}
        <span class="bar-actions">
          <PartyButtons onOpen={props.onOpen} />
          <button type="button" class="create" onClick={props.onLeave}>
            Back to the map
          </button>
        </span>
      </div>
      {w.encounter && (
        <div class="raid-alarm" role="alert">
          <p>{w.encounter.text}</p>
          <button type="button" class="create" onClick={props.onLeave}>
            To the gates
          </button>
        </div>
      )}
      <div class="tabs town-tabs" role="tablist" aria-label="Town">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              props.onTab(t);
              setMessage(null);
            }}
          >
            {TABS[t]}
          </button>
        ))}
      </div>
      <p class="town-message" aria-live="polite">
        {message}
      </p>
      <div class="world-main">
        <div class="world-left">
          <div class="town-main" role="tabpanel" aria-label={TABS[tab]}>
            {tab === 'quests' && <QuestsTab world={w} act={act} />}
            {tab === 'services' && <ServicesTab world={w} act={act} />}
            {tab === 'shop' && <ShopTab world={w} act={act} />}
            {tab === 'stable' && <StableTab world={w} act={act} />}
            {tab === 'tavern' && <TavernTab world={w} roster={props.roster} act={act} />}
            {tab === 'training' && <TrainingTab world={w} act={act} />}
            {tab === 'workshop' && <WorkshopTab world={w} act={act} />}
            {tab === 'craftsman' && <CraftsmanTab world={w} act={act} />}
            {tab === 'travel' && <TravelTab world={w} act={act} onBoard={props.onLeave} />}
            {tab === 'arena' && <ArenaTab world={w} act={act} onBout={props.onBout} />}
          </div>
          <QuestLog world={w} onChange={props.onChange} />
          <SettingPanel world={w} inTown onChange={props.onChange} />
          <FactionsPanel world={w} />
          <JournalPanel world={w} lines={30} />
        </div>
        <div class="world-side flow">
          <PartyPanel members={w.members} />
          <NpcPanel world={w} onChange={props.onChange} />
          <MountsPanel world={w} onChange={props.onChange} />
          <CompanionsPanel world={w} onChange={props.onChange} />
          <PurgePanel world={w} onChange={props.onChange} />
          <AntidotePanel world={w} onChange={props.onChange} />
        </div>
      </div>
    </div>
  );
}
