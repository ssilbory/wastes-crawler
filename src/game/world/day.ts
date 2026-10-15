// The end of each day (docs/rules-adaptation.md, Food and Conditions; SRD 2.12.4 in
// vendor/wwn-srd/2.0 The Rules of the Game/2.12.0 Wilderness Exploration and Expeditions.md, and
// 2.5.3 in vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury, Healing, And System Strain.md):
// the party eats from the rations die, the sleepless and the unsheltered on harsh nights suffer, any
// condition costs 1 System Strain, and the fed, rested, and sheltered (or warmed by a fire) heal and
// recover spells.
import { hexKey } from '../../rules/hex.ts';
import { useResource } from '../../rules/resource-die.ts';
import type { GameData } from '../character/context.ts';
import { addMemberStrain, alive, cureFrailty, easeStrain, healNight, note } from './members.ts';
import { npcCheck } from '../../rules/checks.ts';
import { emit } from './bus.ts';
import { nightForAilments } from './ailments.ts';
import { immuneTo, sacredBlood, tended } from './arts.ts';
import { nightForBeasts } from './beasts.ts';
import { nightForCompanions } from './companion-night.ts';
import { nightForTrees } from './greenwood.ts';
import { dawnTakesSummons } from './summons.ts';
import { wakeRevived } from './healer.ts';
import { nightForMounts } from './mounts.ts';
import { burnFirewood, exposedToCold, harshHere } from './firewood.ts';
import { firstPhysician, nightForNpcs } from './npcs.ts';
import { regionMap } from './region.ts';
import type { Member, World } from './types.ts';
import { wipe } from './town.ts';

/**
 * `waystation`: a coach's night stop, with meals and shelter like a town (Phase 6d).
 * Returns true when the night leaves no one standing: the party falls back to its last town, which
 * already moves the day on, so the caller must not advance it again.
 */
export function endOfDay(w: World, data: GameData, waystation = false): boolean {
  const map = regionMap(data, w.region);
  const inTown = waystation || map.siteAt(w.position) !== undefined;
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
  const outdoors = !sheltered && !w.dungeon;
  const harsh = outdoors && harshHere(w, data);
  const hungry = (m: Member) => !fed && !immuneTo(data, m, 'hungry');
  // Sam's call: a physician's draughts and care keep off everything but hunger.
  const sleepless = (m: Member) => !m.slept && !physician && !immuneTo(data, m, 'sleepless');
  // A fire keeps off the cold, and lets the fed and slept rest (Sam's call), so firewood burns when
  // it would do either for someone.
  const wanted = alive(w).some(
    (m) =>
      !m.reviving &&
      ((harsh && exposedToCold(w, data, m)) || (!w.noRecovery && !hungry(m) && !sleepless(m))),
  );
  const fire = outdoors && wanted ? burnFirewood(w, data) : null;
  if (fire) note(w, `${fire} builds a fire from a night's firewood.`);
  const cold = harsh && !fire;
  const rested = sheltered || fire !== null;
  if (physician) tendFrail(w, data, physician.name);
  // Refined Restoration: a Healer awake at night's end tends the sleepers (Phase 15).
  const care = tended(w);
  // The revived sleep the night through, untouched by hunger, cold, or rest (Phase 14d).
  for (const m of alive(w).filter((x) => !x.reviving)) {
    m.hungry = hungry(m);
    m.sleepless = sleepless(m);
    m.cold = cold && exposedToCold(w, data, m);
    const conditions = [m.hungry && 'Hungry', m.sleepless && 'Sleepless', m.cold && 'Cold'].filter(
      Boolean,
    );
    if (conditions.length > 0) {
      note(w, `${m.character.name} is ${conditions.join(', ')}.`);
      addMemberStrain(w, data, m, 1, 'condition');
    } else if (rested && !w.noRecovery) {
      healNight(data, m, physician ? 1 : 0);
      m.spellsCast = 0;
      m.pointsSpent = 0;
      m.effortDay = 0;
      m.artUses = {};
    }
    // SRD 1.5.9: the Healer's care takes off 1 more strain after a good night's rest.
    if (care && m.slept) easeStrain(m, 1);
    m.slept = false;
  }
  nightForAilments(w, data, inTown);
  if (!rested && !cold)
    note(w, `A night without shelter at ${hexKey(w.position)}: no one recovers.`);
  if (fire && w.noRecovery) note(w, 'The fire keeps off the cold, but no one recovers.');
  nightForBeasts(w, data, fedFree);
  nightForTrees(w);
  dawnTakesSummons(w);
  nightForNpcs(w, data, fed && rested && !w.noRecovery);
  nightForMounts(w, data, fed && rested && !w.noRecovery);
  nightForCompanions(w, data);
  wakeRevived(w);
  w.fallen = null;
  emit(w, data, { kind: 'day-passed' });
  w.camp = 'none';
  w.noRecovery = false;
  w.hikes = 0;
  // Hunger, sleeplessness and cold can finish off the whole party, as a lost fight does.
  if (w.members.length > 0 && alive(w).length === 0) {
    wipe(w, data);
    return true;
  }
  return false;
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
    cureFrailty(m);
    note(w, `${name} nurses ${m.character.name} out of Frailty.`);
  }
}
