// Damage, falling, and saves in combat: vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury,
// Healing, And System Strain.md (2.5.1: PCs are Mortally Injured at 0 HP and die if Frail; unnamed
// NPCs die), and the rear-cover save advantage in docs/rules-adaptation.md; from Phase 18c the
// Necromancer's pooled, deathless, and everlasting lives (4.6.0).
import { netSteps } from '../../rules/advantage.ts';
import { rollSave, type SaveResult, type SaveType } from '../../rules/saves.ts';
import { covered, isUp } from './targeting.ts';
import { say } from './log.ts';
import { abnegate, everlast, keepsDying, redHarvest, vitalFurnace } from './reactions.ts';
import type { Battle, Combatant } from './types.ts';

export { say };

/** Rounds that outlast any fight. */
const SCENE = 1000;

/** Applies damage. Sleepers wake; a hit on a dying PC kills them. */
export function harm(b: Battle, target: Combatant, amount: number): void {
  if (amount <= 0) return;
  if (target.status === 'dying') {
    target.status = 'dead';
    say(b, `${target.name} is slain.`);
    redHarvest(b, target);
    return;
  }
  if (target.status === 'asleep') target.status = 'active';
  // Like the Stones: the first points of every harm are shrugged off (4.5.0).
  if (target.stone > 0) {
    amount -= target.stone;
    if (amount <= 0) {
      say(b, `The blow glances off ${target.name}'s stony flesh.`);
      return;
    }
  }
  // Wrath of the Most High falls with the first damage before it lapses (Phase 14c).
  if (target.wrath) {
    if (b.round <= target.wrath.until) amount += target.wrath.bonus;
    target.wrath = null;
  }
  // Everlasting: no one it covers drops below 1 HP (4.6.0).
  const e = b.everlasting;
  if (e && e.side === target.side && b.round <= e.until) amount = Math.min(amount, target.hp - 1);
  if (amount <= 0) return;
  if (vitalFurnace(b, target, amount) || pooled(b, target, amount)) return;
  wound(b, target, amount);
}

/** Merge Souls: two creatures share one pool of hit points, and fall together when it is spent. */
function pooled(b: Battle, target: Combatant, amount: number): boolean {
  const partner = b.combatants.find((c) => c.id === target.mergedWith);
  if (!partner || !isUp(partner)) return false;
  if (amount >= target.hp + partner.hp) {
    target.hp = 0;
    partner.hp = 0;
    fall(b, target);
    fall(b, partner);
    return true;
  }
  const own = Math.min(amount, target.hp);
  target.hp -= own;
  partner.hp -= amount - own;
  return true;
}

/** Takes the damage off the hit points; at zero the creature falls, unless magic holds it up. */
function wound(b: Battle, target: Combatant, amount: number): void {
  const before = target.hp;
  target.hp = Math.max(0, target.hp - amount);
  if (target.hp > 0) {
    // Augment Mortal Vitality: once a scene, a wound of a quarter of the hit points or more closes.
    const v = target.vitality;
    if (v?.healReady && amount * 4 >= target.maxHp) {
      v.healReady = false;
      target.hp = before;
      say(b, `${target.name}'s wound closes at once.`);
    }
    return;
  }
  // Forgetting the Grave: no dying yet; struck again at zero, a failed save leaves them unable to move.
  if (target.deathlessUntil >= b.round) {
    if (before === 0 && !save(b, target, 'physical').success) target.rootedRounds = SCENE;
    say(b, `${target.name} should be dead, and fights on.`);
    return;
  }
  if (everlast(b, target)) {
    target.hp = 1;
    return;
  }
  fall(b, target);
}

/** A creature at zero hit points falls: monsters and the Frail die, PCs lie Mortally Wounded. */
export function fall(b: Battle, target: Combatant): void {
  if (target.kind === 'monster') {
    die(b, target);
    return;
  }
  // The Frail die at once; Abnegation of Life still spares them (Phase 18a).
  if (target.frail) {
    if (!abnegate(b, target)) die(b, target);
    return;
  }
  if (keepsDying(b, target)) {
    target.status = 'stable';
    target.fellRound = b.round;
    return;
  }
  if (abnegate(b, target)) return;
  target.status = 'dying';
  target.fellRound = b.round;
  say(b, `${target.name} falls, mortally wounded.`);
}

function die(b: Battle, target: Combatant): void {
  target.status = 'dead';
  say(b, `${target.name} dies.`);
  redHarvest(b, target);
}

/** A save with rear-cover advantage and Broken disadvantage. */
export function save(b: Battle, target: Combatant, type: SaveType, modifier = 0): SaveResult {
  const steps = netSteps([covered(b, target) ? 1 : 0, target.strain?.broken ? -1 : 0]);
  const repose = type === 'physical' ? target.reposePenalty : 0;
  // Augment Mortal Vitality adds the caster's Magic skill to Physical saves (4.6.0).
  const vital = type === 'physical' ? (target.vitality?.saveBonus ?? 0) : 0;
  // Sanctified Ward: +4 to every save (1.5.5.1).
  const ward = target.sanctified ? 4 : 0;
  return rollSave(b.rng, target.saves[type], {
    modifier: modifier - repose + ward + vital,
    steps,
  });
}

/**
 * AC with a natural AC if better (Armor of God, Cold Flesh), Total Defense (+2), Sanctified Ward
 * (+4), and Pavis of Elements (+4, never above 18).
 */
export function effectiveAc(c: Combatant): number {
  const ac = Math.max(c.ac, c.acFloor);
  const pavis = c.acBonus > 0 ? Math.max(ac, Math.min(ac + c.acBonus, 18)) : ac;
  return pavis + (c.totalDefense ? 2 : 0) + (c.sanctified ? 4 : 0);
}
