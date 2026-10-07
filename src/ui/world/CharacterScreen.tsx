import { useState } from 'preact/hooks';
import type { World } from '../../game/world/types.ts';
import { CharacterSheet } from '../builder/Sheet.tsx';

/** Each member's full sheet, from the map or a dungeon (Phase 17); their gear is a click away. */
export function CharacterScreen(props: {
  world: World;
  backLabel: string;
  onInventory: (memberId: string) => void;
  onBack: () => void;
}) {
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
        <span class="bar-actions">
          {m && (
            <button type="button" onClick={() => props.onInventory(m.id)}>
              Inventory
            </button>
          )}
          <button type="button" class="create" onClick={props.onBack}>
            {props.backLabel}
          </button>
        </span>
      </div>
      {m && (
        <div class="sub-screen">
          <CharacterSheet character={m.character} />
        </div>
      )}
    </div>
  );
}
