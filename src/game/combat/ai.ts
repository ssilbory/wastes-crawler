// Default decisions. Monsters use tactics (the target most likely to drop) unless a failed
// Instinct check (vendor/wwn-srd/5.0 Monsters and Foes/Instinct Checks.md) makes them lash out at a
// random target; casters cast first, as PCs do, unless Instinct has them. PCs in auto-combat
// stabilize the dying, use combat magic, then attack.
import type { Dice } from '../../data/schemas/index.ts';
import { rollDie } from '../../rules/dice.ts';
import { canUse, castMagic, combatMagic } from './spells.ts';
import { canAct, inMelee, isUp, targets } from './targeting.ts';
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
    const foes = targets(b, actor, a);
    const score = expected(a);
    if (foes.length > 0 && (!best || score > best.score)) best = { index, foes, score };
  });
  return best;
}

export function monsterAction(b: Battle, actor: Combatant): Action {
  if (actor.noncombatant) return noncombatantAction(b, actor);
  const magic = actor.instinctive ? null : magicAction(b, actor);
  if (magic) return magic;
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

const enemiesOf = (b: Battle, actor: Combatant) =>
  b.combatants.filter((c) => c.side !== actor.side && isUp(c));

/** On Turn magic taken before the main action: Pavis of Elements. */
export function freeActions(b: Battle, actor: Combatant): void {
  const pavis = combatMagic(b, 'pavis-of-elements');
  if (pavis && actor.acBonus === 0 && canUse(b, actor, pavis))
    castMagic(b, actor, pavis.id, actor.id, undefined);
}

function magicAction(b: Battle, actor: Combatant): Action | null {
  if (!actor.caster?.canCast) return null;
  const foes = enemiesOf(b, actor).filter((f) => f.status === 'active');
  if (foes.length === 0) return null;
  const ready = (id: string, strain = false, target?: string) => {
    const m = combatMagic(b, id);
    return m !== undefined && canUse(b, actor, m, strain, target);
  };
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
  const first = firstDying(b, actor);
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
  const target = choice.foes.filter(canAct).sort((x, y) => x.hp - y.hp)[0] ?? choice.foes[0];
  return { kind: 'attack', attack: choice.index, target: (target as Combatant).id };
}
