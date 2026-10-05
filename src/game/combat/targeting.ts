// Who can attack whom: the Formation rules in docs/rules-adaptation.md (melee from the front row,
// reach from the second, flyers anywhere, rear cover, exposed rear slots, and downed targets last),
// plus SRD 2.4.4 on ranged attacks with a foe in melee.
import type { AttackMode } from '../../data/schemas/index.ts';
import { coverSteps } from '../../rules/formation.ts';
import type { Attack, Battle, Combatant } from './types.ts';

export const isUp = (c: Combatant) => c.status === 'active' || c.status === 'asleep';
/** Up, awake, and not held by paralysis. */
export const canAct = (c: Combatant) => c.status === 'active' && c.heldRounds === 0;

/** A flyer, or held aloft by Steps of Air (Phase 15). */
export const flying = (c: Combatant) => c.tags.has('flying') || c.flyingRounds > 0;

/** The party's attack modifier in darkness, a house rule: the SRD sets none. */
export const DARK_HIT_MODIFIER = -4;

/**
 * The side's hit modifier (God Wills It), and -4 for a PC fighting in the dark who doesn't see in
 * it (docs/rules-adaptation.md, Dungeon exploration and Phase 15).
 */
export const hitModifier = (b: Battle, actor: Combatant) =>
  b.hitModifier[actor.side] +
  (b.dark && actor.side === 'party' && !actor.seesInDark ? DARK_HIT_MODIFIER : 0);

function side(b: Battle, s: Combatant['side']) {
  return b.combatants.filter((c) => c.side === s);
}

const formation = (b: Battle, c: Combatant) => b.layout[c.side] === 'formation';

/** A formation rear slot with nobody standing directly ahead. */
export function exposed(b: Battle, c: Combatant): boolean {
  if (!formation(b, c) || c.row === 0) return false;
  return !side(b, c.side).some((a) => a.row === 0 && a.column === c.column && canAct(a));
}

/** Rear cover: formation rear slots that are shielded, and every monster row behind the first. */
export function covered(b: Battle, c: Combatant): boolean {
  if (flying(c)) return false;
  return c.row > 0 && !exposed(b, c);
}

/** A front-row combatant facing a foe's front row, so ranged attacks are "in melee". */
export function inMelee(b: Battle, c: Combatant): boolean {
  if (c.row !== 0) return false;
  const other = c.side === 'party' ? 'enemy' : 'party';
  return side(b, other).some(
    (o) => o.row === 0 && canAct(o) && o.attacks.some((a) => a.mode === 'melee'),
  );
}

/** Whether the attack can be used at all from where the attacker stands. */
export function usable(b: Battle, actor: Combatant, attack: Attack): boolean {
  if (attack.mode === 'melee') {
    if (flying(actor)) return true;
    if (actor.row === 0) return true;
    return actor.row === 1 && attack.reach;
  }
  if (actor.row >= 2 && !flying(actor)) return false;
  if (attack.mode === 'ranged' && attack.twoHanded && inMelee(b, actor)) {
    return actor.rangedInMelee !== null;
  }
  return actor.blindRounds === 0;
}

/** Valid targets for an attack; the dying only when nobody else can be reached. */
export function targets(b: Battle, actor: Combatant, attack: Attack, mad = false): Combatant[] {
  // Wind Walking's mist can't strike, nor be struck by weapons (4.5.0).
  if (actor.misted || !usable(b, actor, attack)) return [];
  // The Prismatic Hemicycle's mad turn on their own side (4.4.0).
  const foes = b.combatants.filter(
    (c) => (mad ? c.side === actor.side && c !== actor : c.side !== actor.side) && !c.misted,
  );
  const reachable = (t: Combatant) => {
    if (attack.mode !== 'melee' || flying(actor) || flying(t)) return true;
    return t.row === 0 || exposed(b, t);
  };
  // Sanctified Ward: foes look elsewhere unless acting on Instinct or out of other targets.
  const reached = foes.filter((t) => isUp(t) && reachable(t));
  const unwarded = reached.filter((t) => !t.sanctified);
  const up = actor.instinctive || unwarded.length === 0 ? reached : unwarded;
  const fighting = up.filter((t) => !t.noncombatant);
  if (fighting.length > 0) return fighting;
  if (up.length > 0) return up;
  return foes.filter((t) => t.status === 'dying' && reachable(t));
}

/** Net advantage steps from formation cover, blindness in melee, tower shields, and Broken. */
export function attackSteps(
  b: Battle,
  actor: Combatant,
  target: Combatant,
  mode: AttackMode,
): number {
  let steps = coverSteps(actor.row > 0, covered(b, target), flying(actor));
  if (actor.blindRounds > 0 && mode === 'melee') steps -= 1;
  if (actor.towerShield) steps -= 1;
  if (target.towerShield) steps -= 1;
  if (actor.strain?.broken) steps -= 1;
  return steps;
}

/** SRD 2.4.4: -4 for one-handed or thrown ranged attacks with a foe in melee; Deadeye adjusts 2H. */
export function rangedModifier(b: Battle, actor: Combatant, attack: Attack): number {
  if (attack.mode === 'melee' || !inMelee(b, actor)) return 0;
  return attack.twoHanded ? (actor.rangedInMelee ?? 0) : -4;
}
