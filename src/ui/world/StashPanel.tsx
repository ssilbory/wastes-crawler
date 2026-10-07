import type { World } from '../../game/world/types.ts';
import { stashView } from '../../render/stash-view.ts';
import { data } from '../builder/data.ts';

/** The purse, loot dice, and components the party carries in common. */
export function StashPanel(props: { world: World }) {
  const view = stashView(props.world, data);
  return (
    <section class="panel stash" aria-label="Stash">
      <h3>Party stash</h3>
      <dl class="stash-list">
        <div>
          <dt>Purse</dt>
          <dd>{view.purse}</dd>
        </div>
        <div>
          <dt>Loot dice</dt>
          <dd>{view.loot}</dd>
        </div>
        <div>
          <dt>Components</dt>
          <dd>{view.components.length === 0 ? 'none' : view.components.join(', ')}</dd>
        </div>
      </dl>
    </section>
  );
}
