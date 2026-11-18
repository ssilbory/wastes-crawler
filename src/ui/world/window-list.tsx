import type { ComponentChildren } from 'preact';
import type { World } from '../../game/world/types.ts';
import { ConfirmButton } from '../confirm.tsx';
import { idleLine, type IdleKind } from '../../render/idle-view.ts';
import { data } from '../builder/data.ts';
import { AntidotePanel } from './AntidotePanel.tsx';
import { CompanionsPanel } from './CompanionsPanel.tsx';
import { ConjunctPanel } from './ConjunctPanel.tsx';
import { FactionsPanel } from './FactionsPanel.tsx';
import { FormsPanel } from './FormsPanel.tsx';
import { GreenwoodPanel } from './GreenwoodPanel.tsx';
import { HealerPanel } from './HealerPanel.tsx';
import { HighRoadPanel } from './HighRoadPanel.tsx';
import { MountsPanel } from './MountsPanel.tsx';
import { NecromancyPanel } from './NecromancyPanel.tsx';
import { NpcPanel } from './NpcPanel.tsx';
import { PactPanel } from './PactPanel.tsx';
import type { PartyScreen } from './PartyButtons.tsx';
import { PotionPanel } from './PotionPanel.tsx';
import { ProjectsPanel } from './ProjectsPanel.tsx';
import { PurgePanel } from './PurgePanel.tsx';
import { QuestLog } from './QuestLog.tsx';
import { ScrollPanel } from './ScrollPanel.tsx';
import { SettingPanel } from './SettingPanel.tsx';
import { SorceryPanel } from './SorceryPanel.tsx';
import { WarlordsPanel } from './WarlordsPanel.tsx';
import { WorkingsPanel } from './WorkingsPanel.tsx';

/** The screens that keep their panels in windows. */
export type WindowScreen = 'map' | 'dungeon' | 'town';

export type WindowProps = {
  world: World;
  /** Which screen this is: each offers the panels its dock used to hold. */
  screen: WindowScreen;
  inTown: boolean;
  /** The revive question is up, which has the healers' panel in it. */
  reviving: boolean;
  onChange: () => void;
  onExport: () => void;
  /** Deletes the save; only the overland map offers it. */
  onAbandon?: (() => void) | undefined;
  /** Opens one of the party's own screens; absent with no party to show (a town after a wipe). */
  onOpen?: ((screen: PartyScreen) => void) | undefined;
  /** Back to the Overland's start screen, where the ☰ menu lists the sections again. */
  onStart: () => void;
};

/**
 * A healing window with no one to tend: it stays in the menu while the party has the power, and
 * says there is nothing to do (Sam's call).
 */
function Idle(props: { world: World; kind: IdleKind; label: string }) {
  const line = idleLine(props.world, data, props.kind);
  if (!line) return null;
  return (
    <section class="panel" aria-label={props.label}>
      <h3>{props.label}</h3>
      <p class="hint">{line}</p>
    </section>
  );
}

const ALL: WindowScreen[] = ['map', 'dungeon', 'town'];
const MAP: WindowScreen[] = ['map'];
const WILDS: WindowScreen[] = ['map', 'dungeon'];
const SURFACE: WindowScreen[] = ['map', 'town'];

/**
 * The windows, in the menu's order, and the screens each is on: what that screen's dock held.
 * Each panel shows nothing when it has nothing to say.
 */
export const WINDOWS: {
  id: string;
  label: string;
  on: WindowScreen[];
  body: (p: WindowProps) => ComponentChildren;
}[] = [
  {
    id: 'quests',
    label: 'Quests',
    on: ALL,
    body: (p) => <QuestLog world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'projects',
    label: 'Projects',
    on: SURFACE,
    body: (p) => <ProjectsPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'workings',
    label: 'Workings',
    on: SURFACE,
    body: (p) => <WorkingsPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'npcs',
    label: 'NPCs',
    on: ALL,
    body: (p) => <NpcPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'mounts',
    label: 'Mounts',
    on: SURFACE,
    body: (p) => <MountsPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'companions',
    label: 'Companions',
    on: ALL,
    body: (p) => <CompanionsPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'setting',
    label: 'Orders and sieges',
    on: SURFACE,
    body: (p) => <SettingPanel world={p.world} inTown={p.inTown} onChange={p.onChange} />,
  },
  {
    id: 'necromancy',
    label: 'Necromancy',
    on: WILDS,
    body: (p) => <NecromancyPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'greenwood',
    label: 'Greenwood',
    on: WILDS,
    body: (p) => <GreenwoodPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'forms',
    label: 'Forms',
    on: WILDS,
    body: (p) => <FormsPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'conjunct',
    label: 'Conjunct the Vital Viscera',
    on: WILDS,
    body: (p) => (
      <>
        <ConjunctPanel world={p.world} onChange={p.onChange} />
        <Idle world={p.world} kind="conjunct" label="Conjunct the Vital Viscera" />
      </>
    ),
  },
  {
    id: 'high-road',
    label: 'High Road',
    on: MAP,
    body: (p) => <HighRoadPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'sorcery',
    label: 'High Magic',
    on: WILDS,
    body: (p) => <SorceryPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'pact',
    label: 'Pact of Stone and Sea',
    on: WILDS,
    body: (p) => <PactPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'revive',
    label: 'Revive the Fallen',
    on: WILDS,
    body: (p) =>
      p.reviving ? null : (
        <>
          <HealerPanel world={p.world} onChange={p.onChange} />
          <Idle world={p.world} kind="revive" label="Revive the Fallen" />
        </>
      ),
  },
  {
    id: 'purge',
    label: 'Purge Ailment',
    on: ALL,
    body: (p) => (
      <>
        <PurgePanel world={p.world} onChange={p.onChange} />
        <Idle world={p.world} kind="purge" label="Purge Ailment" />
      </>
    ),
  },
  {
    id: 'antidotes',
    label: 'Antidotes',
    on: ALL,
    body: (p) => <AntidotePanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'potions',
    label: 'Potions',
    on: ALL,
    body: (p) => <PotionPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'scrolls',
    label: 'Scrolls',
    on: WILDS,
    body: (p) => <ScrollPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'factions',
    label: 'Factions',
    on: SURFACE,
    body: (p) => <FactionsPanel world={p.world} />,
  },
  { id: 'warlords', label: 'Warlords', on: MAP, body: (p) => <WarlordsPanel world={p.world} /> },
  {
    id: 'save',
    label: 'Save',
    on: ALL,
    body: (p) => (
      <section class="panel" aria-label="Save">
        <h3>Save</h3>
        <p class="hint">The game saves itself in this browser after every step.</p>
        <div class="actions">
          <button type="button" class="secondary" onClick={p.onExport}>
            Export save
          </button>
          {p.onAbandon && (
            <ConfirmButton class="secondary" confirm="Delete the save" onConfirm={p.onAbandon}>
              Abandon world
            </ConfirmButton>
          )}
        </div>
      </section>
    ),
  },
];
