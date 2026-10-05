// Default decisions. Monsters use tactics (the target most likely to drop) unless a failed
// Instinct check (vendor/wwn-srd/5.0 Monsters and Foes/Instinct Checks.md) makes them lash out at a
// random target; casters cast first, as PCs do, unless Instinct has them. PCs in auto-combat
// stabilize the dying, use combat magic, then attack.
import type { Dice } from '../../data/schemas/index.ts';
import { rollDie } from '../../rules/dice.ts';
import { breathRow } from './specials.ts';
import { canUse, combatMagic } from './spells.ts';
import { canAct, flying, inMelee, isUp, targets } from './targeting.ts';
import type { Action, Attack, Battle, Combatant } from './types.ts';

const average = (d: Dice, bonus: number) => (d.count * (d.sides + 1)) / 2 + d.modifier + bonus;
const expected = (a: Attack) => average(a.damage, a.damageBonus) * (1 + a.hit / 20);

function pickRandom<T>(b: Battle, list: readonly T[]): T {
  return list[rollDie(b.rng, list.length) - 1] as T;
}

/** The usable attack with the best expected damage, and its targets. */
function bestAttack(b: Battle, actor: Combatant): { index: number; foes: Combatant[] } | null {
  let best: { index: number; foes: Combatant[]; score: number } | null = null;
  actor.attacks.forEach((a, index) => {
    // A routine's swing must use its own attack (Phase 14a).
    if (actor.forcedAttack !== null && index !== actor.forcedAttack) return;
    const foes = targets(b, actor, a);
    const score = expected(a);
    if (foes.length > 0 && (!best || score > best.score)) best = { index, foes, score };
  });
  return best;
}

export function monsterAction(b: Battle, actor: Combatant): Action {
  if (actor.noncombatant) return noncombatantAction(b, actor);
  const cursed = cursedAction(b, actor);
  if (cursed) return cursed;
  const magic = actor.instinctive ? null : magicAction(b, actor);
  if (magic) return magic;
  // A breath weapon opens the turn while it lasts (Phase 14a).
  const row = actor.breathLeft > 0 && !actor.instinctive ? breathRow(b, actor) : null;
  if (row !== null) return { kind: 'breath', row };
  const choice = bestAttack(b, actor);
  if (!choice) return { kind: 'wait' };
  const attack = actor.attacks[choice.index] as Attack;
  if (actor.instinctive)
    return { kind: 'attack', attack: choice.index, target: pickRandom(b, choice.foes).id };
  const margin = (t: Combatant) => t.hp - average(attack.damage, attack.damageBonus);
  const lowest = Math.min(...choice.foes.map(margin));
  const target = pickRandom(
    b,
    choice.foes.filter((t) => margin(t) === lowest),
  );
  return { kind: 'attack', attack: choice.index, target: target.id };
}

/**
 * High Magic's curses (Phase 18a): the mad strike at their own side, and a creature whose torment
 * would kill it spends its action trying to throw it off, if it still can.
 */
function cursedAction(b: Battle, actor: Combatant): Action | null {
  if (actor.misted) return { kind: 'end-mist' };
  if (actor.berserk || actor.compelled > 0) {
    // The mad and the compelled strike at their own side with the swing their routine calls for,
    // as reach allows; the compelled with no one to strike stand held.
    const indices = actor.forcedAttack !== null ? [actor.forcedAttack] : actor.attacks.keys();
    for (const index of indices) {
      const near = targets(b, actor, actor.attacks[index] as Attack, true);
      if (near.length > 0) return { kind: 'attack', attack: index, target: pickRandom(b, near).id };
    }
    if (actor.compelled > 0) return { kind: 'wait' };
  }
  const t = actor.torment;
  if (t && !t.tried && !t.lasting && t.damage >= actor.hp) return { kind: 'shake-off' };
  return null;
}

/** Healing arts, in the order the AI reaches for them. */
export const HEALING = ['merciful-healing', 'healing-touch'];

export const enemiesOf = (b: Battle, actor: Combatant) =>
  b.combatants.filter((c) => c.side !== actor.side && isUp(c));

/** The spell or art a caster would use now, if any. */
export function magicAction(b: Battle, actor: Combatant): Action | null {
  if (!actor.caster) return null;
  const foes = enemiesOf(b, actor).filter((f) => f.status === 'active');
  if (foes.length === 0) return null;
  const ready = (id: string, strain = false, target?: string) => {
    const m = combatMagic(b, id);
    return m !== undefined && canUse(b, actor, m, strain, target);
  };
  // Turn False Life when the unnatural stand against the party (Phase 14c).
  const turn = combatMagic(b, 'turn-false-life');
  if (turn?.effect.kind === 'turn' && ready(turn.id)) {
    const tags = turn.effect.tags;
    if (foes.some((f) => tags.some((t) => f.tags.has(t)))) return { kind: 'cast', magic: turn.id };
  }
  const heal = healHurt(b, actor);
  if (heal) return heal;
  // Petrifying Stare brings down a flyer (Phase 15).
  const flyer = foes.find((f) => flying(f) && ready('petrifying-stare', false, f.id));
  if (flyer) return { kind: 'cast', magic: 'petrifying-stare', target: flyer.id };
  const toughest = foes.reduce((a, f) => (f.hp > a.hp ? f : a));
  const weakest = foes.reduce((a, f) => (f.hp < a.hp ? f : a));
  const sleep = combatMagic(b, 'the-wind-of-the-final-repose');
  if (sleep?.effect.kind === 'sleep' && ready(sleep.id)) {
    const max = sleep.effect.maxHitDice;
    const rows = [0, 1, 2].filter(
      (r) =>
        foes.filter((f) => f.row === r && !f.tags.has('unliving') && f.hitDice <= max).length >= 2,
    );
    if (rows.length > 0) return { kind: 'cast', magic: sleep.id, row: rows[0] as number };
  }
  // Smite the Dead on the row with the most undead (Phase 14b).
  const dead = [0, 1, 2].map((r) => foes.filter((f) => f.row === r && f.tags.has('undead')).length);
  if (Math.max(...dead) > 0 && ready('smite-the-dead'))
    return { kind: 'cast', magic: 'smite-the-dead', row: dead.indexOf(Math.max(...dead)) };
  for (const strain of [false, true]) {
    if (ready('the-coruscating-coffin', strain) && (!strain || foes.length >= 2)) {
      return { kind: 'cast', magic: 'the-coruscating-coffin', target: toughest.id, strain };
    }
  }
  if (ready('ineluctable-shackles-of-volition')) {
    return { kind: 'cast', magic: 'ineluctable-shackles-of-volition', target: toughest.id };
  }
  // Stunning Shock takes metal-bearing monsters, and any PC (spells.ts).
  const metal = foes.find(
    (f) => (f.kind === 'pc' || f.tags.has('metal')) && ready('stunning-shock', false, f.id),
  );
  if (metal) return { kind: 'cast', magic: 'stunning-shock', target: metal.id };
  if (ready('elemental-blast'))
    return { kind: 'cast', magic: 'elemental-blast', target: weakest.id };
  return null;
}

/** Merciful Healing or Healing Touch for an ally down to a third of their hit points. */
function healHurt(b: Battle, actor: Combatant): Action | null {
  for (const id of HEALING) {
    const m = combatMagic(b, id);
    const hurt = b.combatants.find(
      (c) =>
        c.side === actor.side &&
        canAct(c) &&
        c.hp * 3 <= c.maxHp &&
        m !== undefined &&
        canUse(b, actor, m, false, c.id),
    );
    if (hurt) return { kind: 'cast', magic: id, target: hurt.id };
  }
  return null;
}

/** The ally who fell first and hasn't been tended this round. */
function firstDying(b: Battle, actor: Combatant): Combatant | undefined {
  const dying = b.combatants.filter(
    (c) => c.side === actor.side && c.status === 'dying' && !b.stabilizedThisRound.has(c.id),
  );
  return dying.sort((x, y) => x.fellRound - y.fellRound)[0];
}

/** Non-combatants only tend the dying, and only with a healer's kit. */
function noncombatantAction(b: Battle, actor: Combatant): Action {
  const first = actor.hasHealKit ? firstDying(b, actor) : undefined;
  return first ? { kind: 'stabilize', target: first.id } : { kind: 'wait' };
}

export function partyAction(b: Battle, actor: Combatant): Action {
  // A misted ally stays out of harm's way while badly hurt (Phase 18b).
  if (actor.misted) return actor.hp * 2 <= actor.maxHp ? { kind: 'wait' } : { kind: 'end-mist' };
  const first = firstDying(b, actor);
  // Healing magic revives the Mortally Wounded, even in melee (Phases 14c and 14d).
  const healing = HEALING.map((id) => combatMagic(b, id)).find(
    (m) => m && canUse(b, actor, m, false, first?.id),
  );
  if (first && healing) return { kind: 'cast', magic: healing.id, target: first.id };
  // Under Sanctified Ward, only heal, tend, or defend (Phase 15).
  if (actor.sanctified)
    return (
      healHurt(b, actor) ??
      (first ? { kind: 'stabilize', target: first.id } : { kind: 'total-defense' })
    );
  if (first && !inMelee(b, actor)) return { kind: 'stabilize', target: first.id };
  const magic = magicAction(b, actor);
  if (magic) return magic;
  const attack = attackWeakest(b, actor);
  if (attack) return attack;
  return first ? { kind: 'stabilize', target: first.id } : { kind: 'wait' };
}

/** The best usable attack against the weakest foe still fighting, or null with nobody in reach. */
export function attackWeakest(b: Battle, actor: Combatant): Action | null {
  const choice = bestAttack(b, actor);
  if (!choice) return null;
  const target = (choice.foes.filter(canAct).sort((x, y) => x.hp - y.hp)[0] ??
    choice.foes[0]) as Combatant;
  // Smite the Wicked is saved for foes of 3 hit dice or more (Phase 14c).
  const smite = combatMagic(b, 'smite-the-wicked');
  if (smite && target.hitDice >= 3 && canUse(b, actor, smite, false, target.id))
    return { kind: 'attack', attack: choice.index, target: target.id, smite: true };
  return { kind: 'attack', attack: choice.index, target: target.id };
}
