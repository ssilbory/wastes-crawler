// The end of each day (docs/rules-adaptation.md, Food and Conditions; SRD 2.12.4 and 2.5.3): the
// party eats from the rations die, the sleepless and the unsheltered on harsh nights suffer, any
// condition costs 1 System Strain, and the fed, rested, and sheltered heal and recover spells.
import { hexKey } from '../../rules/hex.ts';
import { isHarshNight } from '../../rules/overland.ts';
import { useResource } from '../../rules/resource-die.ts';
import type { GameData } from '../character/context.ts';
import { dateOf } from './calendar.ts';
import { addMemberStrain, alive, healNight, note } from './members.ts';
import { nightForNpcs } from './npcs.ts';
import { regionMap } from './region.ts';
import type { World } from './types.ts';

/** `waystation`: a coach's night stop, with meals and shelter like a town (Phase 6d). */
export function endOfDay(w: World, data: GameData, waystation = false): void {
  const map = regionMap(data, w.region);
  const inTown = waystation || map.siteAt(w.position) !== undefined;
  const { season } = dateOf(data.content.overlandRules, w.day);
  let fed = inTown;
  if (!inTown) {
    const use = useResource(w.rng, w.rations);
    fed = use.available;
    if (use.available && use.die < w.rations) note(w, 'The rations run low.');
    if (!use.available) note(w, 'There is nothing left to eat.');
    w.rations = use.die;
  }
  const sheltered = inTown || w.camp === 'made';
  const cold = !sheltered && isHarshNight(map.terrainAt(w.position).harsh, season);
  for (const m of alive(w)) {
    m.hungry = !fed;
    m.sleepless = !m.slept;
    m.cold = cold;
    const conditions = [m.hungry && 'Hungry', m.sleepless && 'Sleepless', m.cold && 'Cold'].filter(
      Boolean,
    );
    if (conditions.length > 0) {
      note(w, `${m.character.name} is ${conditions.join(', ')}.`);
      addMemberStrain(w, data, m, 1, 'condition');
    } else if (sheltered && !w.noRecovery) {
      healNight(data, m);
      m.spellsCast = 0;
      m.effortDay = 0;
    }
    m.slept = false;
  }
  if (!sheltered && !cold)
    note(w, `A night without shelter at ${hexKey(w.position)}: no one recovers.`);
  nightForNpcs(w, data, fed && sheltered && !w.noRecovery);
  w.camp = 'none';
  w.noRecovery = false;
  w.hikes = 0;
}
