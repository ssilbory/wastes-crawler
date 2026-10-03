import { useState } from 'preact/hooks';
import type { RosterEntry } from '../../game/character/roster.ts';
import type { TownResult } from '../../game/world/services.ts';
import { townHere } from '../../game/world/town.ts';
import type { World } from '../../game/world/types.ts';
import { crowns, lootText } from '../../render/town-view.ts';
import { data } from '../builder/data.ts';
import { NpcPanel } from '../world/NpcPanel.tsx';
import { PartyPanel } from '../world/PartyPanel.tsx';
import { ServicesTab } from './ServicesTab.tsx';
import { ShopTab } from './ShopTab.tsx';
import { TavernTab } from './TavernTab.tsx';
import { TrainingTab } from './TrainingTab.tsx';

const TABS = {
  services: 'Inn and temple',
  shop: 'Shop',
  tavern: 'Tavern',
  training: 'Training',
} as const;
type Tab = keyof typeof TABS;

/** Runs a town action and shows its refusal, or a success message when it returns one. */
export type Act = (action: () => TownResult | string) => void;

/** The town hub (docs/rules-adaptation.md, Towns in Phase 6a). */
export function TownScreen(props: {
  world: World;
  roster: RosterEntry[];
  version: number;
  onChange: () => void;
  onLeave: () => void;
}) {
  const w = props.world;
  const town = townHere(w, data);
  const [tab, setTab] = useState<Tab>('services');
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
        <button type="button" onClick={props.onLeave}>
          Back to the map
        </button>
      </div>
      <div class="tabs town-tabs" role="tablist" aria-label="Town">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
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
        <div class="town-main" role="tabpanel" aria-label={TABS[tab]}>
          {tab === 'services' && <ServicesTab world={w} act={act} />}
          {tab === 'shop' && <ShopTab world={w} act={act} />}
          {tab === 'tavern' && <TavernTab world={w} roster={props.roster} act={act} />}
          {tab === 'training' && <TrainingTab world={w} act={act} />}
        </div>
        <div class="world-side">
          <PartyPanel members={w.members} />
          <NpcPanel world={w} onChange={props.onChange} />
          <section class="panel log" aria-label="Journey log">
            <h3>Journal</h3>
            <ol>
              {w.log.slice(-30).map((line, i) => (
                <li key={`${i}-${line}`}>{line}</li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
