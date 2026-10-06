import type { World } from '../../game/world/types.ts';
import { stashView } from '../../render/stash-view.ts';
import { data } from '../builder/data.ts';

/** The purse, loot dice, and components the party carries in common. */
export function StashPanel(props: { world: World }) {
  const view = stashView(props.world, data);
  return (
    <section class="panel" aria-label="Stash">
      <h3>Party stash</h3>
      <p>Purse: {view.purse}</p>
      <p>Loot dice: {view.loot}</p>
      <p>Components: {view.components.length === 0 ? 'none' : view.components.join(', ')}</p>
    </section>
  );
}
