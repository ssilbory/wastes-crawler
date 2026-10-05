import { useState } from 'preact/hooks';
import type { World } from '../../game/world/types.ts';
import { CharacterSheet } from '../builder/Sheet.tsx';
import { InventoryPanel } from './InventoryPanel.tsx';

/** Each member's full sheet and gear, from the map or a dungeon (Phase 17). */
export function CharacterScreen(props: { world: World; onChange: () => void; onBack: () => void }) {
  const w = props.world;
  const [who, setWho] = useState(w.members[0]?.id ?? '');
  const m = w.members.find((x) => x.id === who) ?? w.members[0];
  return (
    <div class="world characters">
      <div class="world-bar">
        <div class="tabs" role="tablist" aria-label="Party members">
          {w.members.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={x === m}
              onClick={() => setWho(x.id)}
            >
              {x.character.name}
              {x.dead ? ' (dead)' : ''}
            </button>
          ))}
        </div>
        <button type="button" class="create" onClick={props.onBack}>
          {w.dungeon ? 'Back to the dungeon' : 'Back to the map'}
        </button>
      </div>
      {m && (
        <div class="world-main">
          <CharacterSheet character={m.character} />
          <div class="world-side">
            <InventoryPanel world={w} memberId={m.id} onChange={props.onChange} />
          </div>
        </div>
      )}
    </div>
  );
}
