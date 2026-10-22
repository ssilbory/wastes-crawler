import type { World } from '../../game/world/types.ts';
import { setDefaultAction } from '../../game/world/members.ts';
import { knownFoes } from '../../render/bestiary-view.ts';
import { FightScreen } from '../arena/FightScreen.tsx';
import { data } from '../builder/data.ts';
import type { Fight } from './tending.ts';

/**
 * A fight on the overland, in a dungeon, or in a town's arena, on the arena's fight screen. Each
 * fight settles once: `settled` remembers the ones done, so a second click on Back can't settle the
 * same fight again.
 */
export function WorldFight(props: {
  world: World;
  fight: Fight;
  settled: WeakSet<object>;
  onChange: () => void;
  /** The fight is over and settled (or left unfought): back to the screen it came from. */
  onDone: () => void;
}) {
  const { world: w, fight } = props;
  return (
    <div class="arena">
      <FightScreen
        createBattle={() => fight.battle.battle}
        presets={fight.battle.memberIds.map(
          (id) => w.members.find((m) => m.id === id)?.defaultAction ?? 'auto',
        )}
        onPreset={(i, preset) => {
          const id = fight.battle.memberIds[i];
          if (!id) return;
          setDefaultAction(w, id, preset);
          props.onChange();
        }}
        canLeave={false}
        xp={fight.xp}
        aftermath={fight.aftermath ?? false}
        known={knownFoes(w, data, fight.battle.enemies)}
        doneLabel={
          fight.back === 'town'
            ? 'Back to town'
            : w.dungeon
              ? 'Back to the dungeon'
              : 'Back to the map'
        }
        onDone={(result) => {
          if (!result) return props.onDone();
          if (props.settled.has(fight)) return;
          props.settled.add(fight);
          void Promise.resolve(fight.settle(result)).then(props.onDone);
        }}
      />
    </div>
  );
}
