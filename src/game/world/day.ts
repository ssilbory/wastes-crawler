// The end of each day (docs/rules-adaptation.md, Food and Conditions; SRD 2.12.4 and 2.5.3): the
// party eats from the rations die, the sleepless and the unsheltered on harsh nights suffer, any
// condition costs 1 System Strain, and the fed, rested, and sheltered heal and recover spells.
import { hexKey } from '../../rules/hex.ts';
import { isHarshNight } from '../../rules/overland.ts';
import { useResource } from '../../rules/resource-die.ts';
import type { GameData } from '../character/context.ts';
import { dateOf } from './calendar.ts';
import { addMemberStrain, alive, healNight, note } from './members.ts';
import { npcCheck } from '../../rules/checks.ts';
import { emit } from './bus.ts';
import { immuneTo, sacredBlood } from './arts.ts';
import { nightForBeasts } from './beasts.ts';
import { wakeRevived } from './healer.ts';
import { firstPhysician, nightForNpcs } from './npcs.ts';
import { regionMap } from './region.ts';
import type { World } from './types.ts';

/** `waystation`: a coach's night stop, with meals and shelter like a town (Phase 6d). */
export function endOfDay(w: World, data: GameData, waystation = false): void {
  const map = regionMap(data, w.region);
  const inTown = waystation || map.siteAt(w.position) !== undefined;
  const { season } = dateOf(data.content.overlandRules, w.day);
  // Transubstantiation's sacred blood feeds the party in place of the rations (Phase 15).
  const fedFree = inTown || sacredBlood(w, data);
  let fed = fedFree;
  if (!fed) {
    const use = useResource(w.rng, w.rations);
    fed = use.available;
    if (use.available && use.die < w.rations) note(w, 'The rations run low.');
    if (!use.available) note(w, 'There is nothing left to eat.');
    w.rations = use.die;
  }
  const sheltered = inTown || w.camp === 'made';
  const physician = firstPhysician(w, data);
  // Underground there is no weather.
  const cold = !sheltered && !w.dungeon && isHarshNight(map.terrainAt(w.position).harsh, season);
  if (physician) tendFrail(w, data, physician.name);
  // The revived sleep the night through, untouched by hunger, cold, or rest (Phase 14d).
  for (const m of alive(w).filter((x) => !x.reviving)) {
    m.hungry = !fed && !immuneTo(data, m, 'hungry');
    // Sam's call: a physician's draughts and care keep off everything but hunger.
    m.sleepless = !m.slept && !physician && !immuneTo(data, m, 'sleepless');
    m.cold = cold && !physician && !immuneTo(data, m, 'cold');
    const conditions = [m.hungry && 'Hungry', m.sleepless && 'Sleepless', m.cold && 'Cold'].filter(
      Boolean,
    );
    if (conditions.length > 0) {
      note(w, `${m.character.name} is ${conditions.join(', ')}.`);
      addMemberStrain(w, data, m, 1, 'condition');
    } else if (sheltered && !w.noRecovery) {
      healNight(data, m, physician ? 1 : 0);
      m.spellsCast = 0;
      m.effortDay = 0;
      m.artUses = {};
    }
    m.slept = false;
  }
  if (!sheltered && !cold)
    note(w, `A night without shelter at ${hexKey(w.position)}: no one recovers.`);
  nightForBeasts(w, data, fedFree);
  nightForNpcs(w, data, fed && sheltered && !w.noRecovery);
  wakeRevived(w);
  w.fallen = null;
  emit(w, data, { kind: 'day-passed' });
  w.camp = 'none';
  w.noRecovery = false;
  w.hikes = 0;
}

/**
 * SRD 2.5.0 (vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury, Healing, And System
 * Strain.md): a physician with a healer's kit can try to remove Frailty, a Heal check against
 * difficulty 10; Sam's call lets a hired physician try each night, at the common hireling's +1.
 */
function tendFrail(w: World, data: GameData, name: string): void {
  for (const m of alive(w).filter((x) => x.frail)) {
    const check = npcCheck(w.rng, { skillBonus: data.content.npcRules.skillBonus, difficulty: 10 });
    if (!check.success) continue;
    m.frail = false;
    note(w, `${name} nurses ${m.character.name} out of Frailty.`);
  }
}
