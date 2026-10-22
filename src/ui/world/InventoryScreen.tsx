import { useState } from 'preact/hooks';
import type { World } from '../../game/world/types.ts';
import { panelProps, Tabs } from '../tabs.tsx';
import { InventoryPanel } from './InventoryPanel.tsx';
import { StashPanel } from './StashPanel.tsx';

/** Each member's gear on a screen of its own, with what the party carries in common. */
export function InventoryScreen(props: {
  world: World;
  /** The member to open on, when the screen is reached from their character sheet. */
  memberId?: string | undefined;
  backLabel: string;
  onChange: () => void;
  onBack: () => void;
}) {
  const w = props.world;
  const [who, setWho] = useState(props.memberId ?? w.members[0]?.id ?? '');
  const m = w.members.find((x) => x.id === who) ?? w.members[0];
  return (
    <div class="world inventory-screen">
      <div class="world-bar">
        <h1 class="date">Inventory</h1>
        <Tabs
          id="inventory-members"
          label="Party members"
          tabs={w.members.map((x) => ({
            key: x.id,
            label: `${x.character.name}${x.dead ? ' (dead)' : ''}`,
          }))}
          selected={m?.id ?? ''}
          onSelect={setWho}
        />
        <span class="bar-actions">
          <button type="button" class="create" onClick={props.onBack}>
            {props.backLabel}
          </button>
        </span>
      </div>
      {m && (
        <div class="sub-screen" {...panelProps('inventory-members', m.id)}>
          <InventoryPanel world={w} memberId={m.id} onChange={props.onChange} />
          <StashPanel world={w} onChange={props.onChange} />
        </div>
      )}
    </div>
  );
}
