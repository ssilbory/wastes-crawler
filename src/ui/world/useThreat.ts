import { useEffect, useState } from 'preact/hooks';
import { difficultySeed } from '../../game/world/difficulty.ts';
import { threatSetup } from '../../game/world/fight.ts';
import type { World } from '../../game/world/types.ts';
import { threatText } from '../../render/threat-view.ts';
import { data } from '../builder/data.ts';
import { assess } from './assess.ts';

/**
 * How the pending encounter looks (render/threat-view.ts), from the XP difficulty simulation run
 * as soon as it is met, on its own seed. Weighed again whenever the line-up or the world's RNG
 * moves on (a parley, a spell); null while the trial fights run.
 */
export function useThreat(w: World): string | null {
  const setup = w.encounter ? threatSetup(w, data) : null;
  const seed = difficultySeed(w);
  const key = setup && `${seed}|${JSON.stringify(setup)}`;
  const [shown, setShown] = useState<{ key: string; text: string } | null>(null);
  useEffect(() => {
    if (!setup || !key) return;
    let live = true;
    void assess({ setup, seed, fights: data.content.townRules.xp.simFights }).then((d) => {
      if (live) setShown({ key, text: threatText(data, d) });
    });
    return () => {
      live = false;
    };
  }, [key]);
  return shown && shown.key === key ? shown.text : null;
}
