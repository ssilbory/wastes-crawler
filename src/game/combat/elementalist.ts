// Elementalist magic in combat (Phase 18b): what each spell does when cast, from its text in
// vendor/wwn-srd/4.0 Magic and Spellcasting/4.5.0 Elementalist Spells.md, one fixed element each:
// a wall of fire, a body of stone, an earth guardian (docs/rules-adaptation.md, Elementalist spells
// in combat). The wall and the Fury play out in conditions.ts.
import type { CombatEffect } from '../../data/schemas/index.ts';
import { roll } from '../../rules/dice.ts';
import { harm, say } from './damage.ts';
import type { Resists } from './high-magic.ts';
import { isUp } from './targeting.ts';
import type { Battle, CasterState, Combatant, SideId } from './types.ts';

const foeSide = (actor: Combatant): SideId => (actor.side === 'party' ? 'enemy' : 'party');

/** Strikes every creature standing in one of a side's rows. */
export function smite(b: Battle, side: SideId, row: number, total: number): void {
  for (const t of b.combatants.filter((c) => c.side === side && c.row === row && isUp(c)))
    harm(b, t, total);
}

/** An Elementalist spell's effect; false for any other effect. */
export function elementalistEffect(
  b: Battle,
  actor: Combatant,
  e: CombatEffect,
  target: Combatant | undefined,
  row: number | undefined,
  resists: Resists,
): boolean {
  const level = (actor.caster as CasterState).level;
  switch (e.kind) {
    case 'flame-weapon':
      if (target) {
        target.flame = e.bonus;
        say(b, `${target.name}'s weapon takes an endless flame.`);
      }
      return true;
    case 'wall':
      b.walls.push({ side: foeSide(actor), damage: e.damage, bonus: level, crossed: [] });
      say(b, `A wall of fire rises before ${actor.name}'s side.`);
      return true;
    case 'stone-form':
      Object.assign(actor, { stone: e.ignore, poisonImmune: true });
      say(b, `${actor.name}'s flesh takes on the weight of stone.`);
      return true;
    case 'mist':
      if (target) {
        target.misted = true;
        say(b, `${target.name} thins into a drifting mist.`);
      }
      return true;
    case 'calcify':
      if (!target) return true;
      if (resists(target, e.save)) {
        target.rootedRounds = Math.max(target.rootedRounds, roll(b.rng, e.slowed).total);
        say(b, `${target.name} stiffens, slowed but not stilled.`);
      } else {
        target.status = 'out';
        target.spellbound = true;
        say(b, `${target.name} is turned to stone.`);
      }
      return true;
    case 'fury': {
      const side = foeSide(actor);
      const at = row ?? 0;
      say(b, `Molten rock and searing steam erupt among ${b.sideNames[side]}.`);
      smite(b, side, at, roll(b.rng, e.damage).total);
      b.fury = { side, row: at, damage: e.damage, roundsLeft: roll(b.rng, e.rounds).total - 1 };
      return true;
    }
    default:
      return false;
  }
}
