// A Beastmaster and their companion in a fight (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class
// List/1.5.4 The Beastmaster.md; docs/rules-adaptation.md, The Beastmaster): binding a beast among
// the foes, Shared Vitality's stabilizing, a Howl of Distant Summons for a companion sent away,
// Mind Call's commands, Know the Weak Spot, and Beast Ward.
import { maxCompanionHitDice, sharedHitFloor } from '../../rules/beastmaster.ts';
import { servantPlace } from '../../rules/formation.ts';
import { followRiders, inSlot } from './mounted.ts';
import { save } from './saves.ts';
import { say } from './log.ts';
import { monsterCombatant } from './monster-combatant.ts';
import { artReady, spendDay } from './reactions.ts';
import { canAct, isUp } from './targeting.ts';
import type { Battle, CasterState, Combatant, WaitingCompanion } from './types.ts';

const masterOf = (b: Battle, c: Combatant) =>
  c.companion ? b.combatants.find((x) => x.id === c.companion?.master) : undefined;

/** Beasts among the foes the actor could try to bind: up, and of no more than level + 1 HD. */
export function bindTargets(b: Battle, actor: Combatant): Combatant[] {
  if (!actor.canBind || !actor.caster?.arts.includes('bind-companion')) return [];
  const most = maxCompanionHitDice(actor.hitDice);
  return b.combatants.filter(
    (t) =>
      t.side !== actor.side &&
      t.beast &&
      isUp(t) &&
      t.hitDice <= most &&
      !t.summoned &&
      !actor.caster?.usedThisScene.has(`bind:${t.id}`),
  );
}

/** A slot on the actor's side for a creature joining it, stepping someone back if it must. */
function joinSide(b: Battle, side: Combatant['side'], who: Combatant): boolean {
  const mine = b.combatants.filter(
    (c) => c.side === side && c !== who && c.status !== 'dead' && inSlot(c),
  );
  const place = servantPlace(mine.map((c) => ({ ...c, yields: isUp(c) && !c.servant })));
  if (!place) return false;
  const bumped = place.bump ? mine[place.bump.index] : undefined;
  if (place.bump && bumped) {
    Object.assign(bumped, { row: 1, column: place.bump.column });
    say(b, `${bumped.name} steps back for ${who.name}.`);
    followRiders(b.combatants);
  }
  Object.assign(who, { side, row: place.row, column: place.column, group: place.row });
  return true;
}

/**
 * Bind Companion as a Main Action: the beast makes a Mental save; failing, it joins the party as the
 * Beastmaster's companion. Saving, it can't be bound by them again.
 */
export function bind(b: Battle, actor: Combatant, targetId: string): void {
  const t = bindTargets(b, actor).find((x) => x.id === targetId);
  if (!t) return;
  (actor.caster as CasterState).usedThisScene.add(`bind:${t.id}`);
  say(b, `${actor.name} tries to bind ${t.name}.`);
  if (save(b, t, 'mental').success) {
    say(b, `${t.name} shakes off the bond.`);
    return;
  }
  if (b.layout[actor.side] !== 'formation' || !joinSide(b, actor.side, t)) {
    say(b, `There is no room for ${t.name} beside ${actor.name}.`);
    return;
  }
  actor.canBind = false;
  Object.assign(t, {
    servant: true,
    bound: { by: actor.id },
    companion: { master: actor.id, chosen: false, shared: false },
    instinctive: false,
  });
  say(b, `${t.name} turns, bound to ${actor.name}.`);
}

/**
 * Shared Vitality: Effort for the scene, as an Instant action, stabilizes a companion that would
 * die, while its master can act.
 */
export function vitalHold(b: Battle, target: Combatant): boolean {
  const master = masterOf(b, target);
  if (!target.companion?.shared || !master || !canAct(master)) return false;
  const c = master.caster;
  if (!c || c.effortUsed >= c.effortMax) return false;
  c.effortUsed += 1;
  target.status = 'stable';
  say(b, `${master.name} holds on to ${target.name}'s life.`);
  return true;
}

/** Howl of Distant Summons: a Main Action for Effort for the day, with a companion waiting. */
export const canHowl = (actor: Combatant): boolean =>
  actor.waiting !== null && actor.waiting.hp > 0 && artReady(actor, 'howl-of-distant-summons');

/** The companion is on its way, to join the fight at the start of the next round. */
export function howl(b: Battle, actor: Combatant): void {
  if (!canHowl(actor)) return;
  const w = actor.waiting as WaitingCompanion;
  spendDay(actor.caster as CasterState);
  actor.waiting = null;
  const c = companionCombatant(b, w, `howl-${actor.id}`, actor.id);
  Object.assign(c, { side: actor.side, status: 'out', returnsRound: b.round + 1 });
  b.combatants.push(c);
  say(b, `${actor.name} howls for ${w.name}.`);
}

/** A howled companion arrives at the round's start, where there is room for it. */
export function arrive(b: Battle, c: Combatant): void {
  c.returnsRound = 0;
  if (!joinSide(b, c.side, c)) {
    say(b, `${c.name} arrives, but finds no room in the line.`);
    return;
  }
  c.status = 'active';
  say(b, `${c.name} bounds in, answering the howl.`);
}

/** A companion as a combatant: its stat line, with Shared Vitality's hit bonus floor. */
function companionCombatant(b: Battle, w: WaitingCompanion, id: string, master: string): Combatant {
  const c = monsterCombatant(b.data, w.monster, id, b.rng);
  return {
    ...c,
    ...lifted(c, w),
    name: w.name,
    hp: w.hp,
    maxHp: w.maxHp,
    servant: true,
    companion: { master, chosen: w.chosen, shared: w.shared },
  };
}

/** Shared Vitality's hit dice, and a hit bonus of at least half of them, rounded up. */
export function lifted(c: Combatant, w: Pick<WaitingCompanion, 'hitDice' | 'shared'>) {
  if (!w.shared) return {};
  const floor = sharedHitFloor(w.hitDice);
  return {
    hitDice: w.hitDice,
    attacks: c.attacks.map((a) => ({ ...a, hit: Math.max(a.hit, floor) })),
  };
}

/**
 * Mind Call: a companion takes its master's commands while they can act and have committed Effort
 * for the scene to it, or could; a Chosen Friend needs no Effort.
 */
export function answersCall(b: Battle, c: Combatant): boolean {
  const master = masterOf(b, c);
  if (!c.companion || !master || !canAct(master)) return false;
  if (c.companion.chosen) return true;
  const m = master.caster;
  return m !== null && (m.usedThisScene.has('mind-call') || artReady(master, 'mind-call'));
}

/** Commits Mind Call's Effort for the scene the first time the companion takes a command. */
export function heedCall(b: Battle, c: Combatant): void {
  const m = masterOf(b, c)?.caster;
  if (!m || c.companion?.chosen || m.usedThisScene.has('mind-call')) return;
  m.usedThisScene.add('mind-call');
  m.effortUsed += 1;
}

/** Know the Weak Spot: a blow on a beast rolls its damage twice and keeps the better. */
export const knowsWeakSpot = (actor: Combatant, target: Combatant): boolean =>
  target.beast && actor.caster?.arts.includes('know-the-weak-spot') === true;

/** A hostile act against a beast frees it from Beast Ward. */
export function provoke(attacker: Combatant, target: Combatant): void {
  if (target.beast && attacker.side !== target.side) target.provoked = true;
}
