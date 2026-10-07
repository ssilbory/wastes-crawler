import type { World } from '../../game/world/types.ts';
import { FormationPanel } from './FormationPanel.tsx';
import { PartyPanel } from './PartyPanel.tsx';

/** The marching order on a screen of its own, reached from the map, a dungeon, or a town. */
export function FormationScreen(props: {
  world: World;
  backLabel: string;
  onChange: () => void;
  onBack: () => void;
}) {
  const w = props.world;
  return (
    <div class="world formation-screen">
      <div class="world-bar">
        <h1 class="date">Formation</h1>
        <span class="bar-actions">
          <button type="button" class="create" onClick={props.onBack}>
            {props.backLabel}
          </button>
        </span>
      </div>
      <p class="hint">
        Each rear slot is shielded by the slot ahead of it. Characters in front fight in melee.
      </p>
      <div class="sub-screen">
        <FormationPanel world={w} onChange={props.onChange} />
        <PartyPanel members={w.members} />
      </div>
    </div>
  );
}
