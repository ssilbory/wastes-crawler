import type { ComponentChildren, RefObject } from 'preact';
import { useCallback, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { World } from '../../game/world/types.ts';
import { ConfirmButton } from '../confirm.tsx';
import { useDialog } from '../dialog.ts';
import { idleLine, type IdleKind } from '../../render/idle-view.ts';
import { data } from '../builder/data.ts';
import { useProvideScreenMenu, type MenuItem } from '../screen-menu.ts';
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

type Props = {
  world: World;
  inTown: boolean;
  /** The revive question is up, which has the healers' panel in it. */
  reviving: boolean;
  onChange: () => void;
  onExport: () => void;
  onAbandon: () => void;
  /** Opens one of the party's own screens. */
  onOpen: (screen: PartyScreen) => void;
  /** Back to the Overland's start screen, where the ☰ menu lists the sections again. */
  onStart: () => void;
};

/** The ☰ item that leaves the map. */
const START = 'start';

/** The party's screens, in the menu as well as the bar: a phone's bar has no room for them. */
const SCREENS: { id: PartyScreen; label: string }[] = [
  { id: 'character', label: 'Characters' },
  { id: 'formation', label: 'Formation' },
  { id: 'inventory', label: 'Inventory' },
];

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

/** The map's windows, in the menu's order. Each panel shows nothing when it has nothing to say. */
const WINDOWS: { id: string; label: string; body: (p: Props) => ComponentChildren }[] = [
  {
    id: 'quests',
    label: 'Quests',
    body: (p) => <QuestLog world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'projects',
    label: 'Projects',
    body: (p) => <ProjectsPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'workings',
    label: 'Workings',
    body: (p) => <WorkingsPanel world={p.world} onChange={p.onChange} />,
  },
  { id: 'npcs', label: 'NPCs', body: (p) => <NpcPanel world={p.world} onChange={p.onChange} /> },
  {
    id: 'mounts',
    label: 'Mounts',
    body: (p) => <MountsPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'companions',
    label: 'Companions',
    body: (p) => <CompanionsPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'setting',
    label: 'Orders and sieges',
    body: (p) => <SettingPanel world={p.world} inTown={p.inTown} onChange={p.onChange} />,
  },
  {
    id: 'necromancy',
    label: 'Necromancy',
    body: (p) => <NecromancyPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'greenwood',
    label: 'Greenwood',
    body: (p) => <GreenwoodPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'forms',
    label: 'Forms',
    body: (p) => <FormsPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'conjunct',
    label: 'Conjunct the Vital Viscera',
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
    body: (p) => <HighRoadPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'sorcery',
    label: 'High Magic',
    body: (p) => <SorceryPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'pact',
    label: 'Pact of Stone and Sea',
    body: (p) => <PactPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'revive',
    label: 'Revive the Fallen',
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
    body: (p) => <AntidotePanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'potions',
    label: 'Potions',
    body: (p) => <PotionPanel world={p.world} onChange={p.onChange} />,
  },
  {
    id: 'scrolls',
    label: 'Scrolls',
    body: (p) => <ScrollPanel world={p.world} onChange={p.onChange} />,
  },
  { id: 'factions', label: 'Factions', body: (p) => <FactionsPanel world={p.world} /> },
  { id: 'warlords', label: 'Warlords', body: (p) => <WarlordsPanel world={p.world} /> },
  {
    id: 'save',
    label: 'Save',
    body: (p) => (
      <section class="panel" aria-label="Save">
        <h3>Save</h3>
        <p class="hint">The game saves itself in this browser after every step.</p>
        <div class="actions">
          <button type="button" class="secondary" onClick={p.onExport}>
            Export save
          </button>
          <ConfirmButton class="secondary" confirm="Delete the save" onConfirm={p.onAbandon}>
            Abandon world
          </ConfirmButton>
        </div>
      </section>
    ),
  },
];

/** Focus and the keyboard for the open window, held only while one is open (dialog.ts). */
function WindowFocus(props: { box: RefObject<HTMLDivElement>; onEscape: () => void }) {
  useDialog({ box: props.box, trap: true, onEscape: props.onEscape });
  return null;
}

/**
 * The overland map's panels as windows opened from the ☰ menu (Sam's call), so the dock holds the
 * quarter's plan alone and nothing scrolls. Every panel stays mounted, hidden until its window is
 * opened, so each keeps what it was showing; the menu lists only those with something in them. A
 * window opens over an encounter too, as the dock stayed in reach beside one (a countersign to
 * look up, say).
 */
export function MapWindows(props: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [filled, setFilled] = useState<string[]>([]);
  const card = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);
  // A panel with nothing to say renders nothing, which is how the menu learns to leave it out.
  useLayoutEffect(() => {
    const now = [...(card.current?.querySelectorAll<HTMLElement>('[data-window]') ?? [])]
      .filter((el) => el.childElementCount > 0)
      .map((el) => el.dataset.window ?? '');
    if (now.join() !== filled.join()) setFilled(now);
    if (open !== null && !now.includes(open)) setOpen(null);
  });
  const windows = WINDOWS.filter((v) => filled.includes(v.id));
  const items: MenuItem[] = [
    ...SCREENS,
    ...windows.map((v, i) => ({ id: v.id, label: v.label, ...(i === 0 ? { rule: true } : {}) })),
    { id: START, label: 'Return to Overland start', rule: true },
  ];
  useProvideScreenMenu(items, (id) => {
    const screen = SCREENS.find((v) => v.id === id);
    if (screen) props.onOpen(screen.id);
    else if (id === START) props.onStart();
    else setOpen(id);
  });
  const shown = open !== null;
  return (
    <div
      class={shown ? 'pop-out map-window' : undefined}
      hidden={!shown}
      // A click on the dimmed screen about the window closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {shown && <WindowFocus box={card} onEscape={close} />}
      <div
        ref={card}
        class="pop-out-card"
        role="dialog"
        aria-label={WINDOWS.find((v) => v.id === open)?.label ?? 'Window'}
        aria-modal={shown ? 'true' : undefined}
        tabIndex={-1}
      >
        {WINDOWS.map((v) => (
          <div key={v.id} data-window={v.id} hidden={v.id !== open}>
            {v.body(props)}
          </div>
        ))}
        <div class="map-window-foot">
          <button type="button" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
