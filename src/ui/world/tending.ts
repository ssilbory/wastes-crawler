import type { BattleResult } from '../../game/combat/battle.ts';
import { applyTending, tendingBattle } from '../../game/dungeon/trap-falls.ts';
import type { WorldBattle } from '../../game/world/fight.ts';
import type { World } from '../../game/world/types.ts';
import { data } from '../builder/data.ts';

/** The fight on screen, what settles it, and where the party goes after. */
export interface Fight {
  battle: WorldBattle;
  settle: (result: BattleResult) => void | Promise<void>;
  back: 'map' | 'town';
  /** The XP a win earns, once the simulation has judged the fight; none in the arena. */
  xp?: Promise<string>;
  /** Tending a trap's fallen: no foes, only the dying. */
  aftermath?: boolean;
}

/** The fight screen's care for the dying, over those a trap brought down. */
export function tending(w: World): Fight {
  const battle = tendingBattle(w, data);
  return { battle, settle: () => applyTending(w, data, battle), back: 'map', aftermath: true };
}
