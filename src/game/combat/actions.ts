// Resolving one chosen action (vendor/wwn-srd/2.0 The Rules of the Game/2.4.3 Combat Actions.md),
// including stabilizing the dying (2.5.1).
import { skillCheck } from '../../rules/checks.ts';
import { stabilizeDifficulty } from '../../rules/combat.ts';
import { ROW_SLOTS } from '../../rules/formation.ts';
import { resolveAttack, type AttackBoost } from './attack.ts';
import { say } from './damage.ts';
import { breathe } from './specials.ts';
import { castMagic, combatMagic } from './spells.ts';
import { targets } from './targeting.ts';
import type { Action, Battle, CasterState, Combatant } from './types.ts';

export function stabilize(b: Battle, actor: Combatant, target: Combatant): void {
  if (target.status !== 'dying' || b.stabilizedThisRound.has(target.id)) return;
  b.stabilizedThisRound.add(target.id);
  const check = skillCheck(b.rng, {
    skill: actor.skills.heal ?? null,
    attributeModifier: actor.healModifier,
    difficulty: stabilizeDifficulty(b.round - target.fellRound, actor.hasHealKit),
  });
  if (!check.success) return;
  target.status = 'stable';
  target.frail = true;
  say(b, `${actor.name} stabilizes ${target.name}.`);
}

/** Spends Smite the Wicked on the target, if the actor can, for its boost. */
function smiteBoost(b: Battle, actor: Combatant, target: Combatant): AttackBoost | null {
  const m = combatMagic(b, 'smite-the-wicked');
  if (m?.effect.kind !== 'smite-wicked' || !castMagic(b, actor, m.id, target.id, undefined))
    return null;
  return { hit: m.effect.hit, damage: (actor.caster as CasterState).level };
}

/** Sanctified Ward ends with an attack or magic aimed at a foe (1.5.5.1). */
function hostile(b: Battle, action: Action): boolean {
  if (action.kind === 'attack') return true;
  if (action.kind !== 'cast') return false;
  const target = b.data.content.combatMagic.find((m) => m.id === action.magic)?.target;
  return target === 'enemy' || target === 'enemy-row' || target === 'enemies';
}

export function act(b: Battle, actor: Combatant, action: Action): void {
  const target = 'target' in action ? b.combatants.find((c) => c.id === action.target) : undefined;
  if (actor.sanctified && hostile(b, action)) {
    actor.sanctified = false;
    say(b, `${actor.name}'s ward falls away.`);
  }
  switch (action.kind) {
    case 'attack': {
      const attack = actor.attacks[action.attack];
      if (!attack || !target || !targets(b, actor, attack).includes(target)) return;
      // Smite the Wicked (Phase 14c): paid for as the attack is made, once per target a scene.
      const smite = action.smite ? smiteBoost(b, actor, target) : null;
      resolveAttack(b, actor, attack, target, smite);
      return;
    }
    case 'cast':
      castMagic(b, actor, action.magic, action.target, action.row, action.strain);
      return;
    case 'breath':
      breathe(b, actor, action.row);
      return;
    case 'total-defense':
      actor.totalDefense = true;
      return;
    case 'stabilize':
      if (target && target.side === actor.side) stabilize(b, actor, target);
      return;
    case 'move': {
      const taken = b.combatants.some(
        (c) => c.side === actor.side && c.row === action.row && c.column === action.column,
      );
      const slot = action.row >= 0 && action.row <= 1 && action.column >= 0;
      const inFormation = b.layout[actor.side] === 'formation';
      if (inFormation && !taken && slot && action.column < ROW_SLOTS) {
        actor.row = action.row;
        actor.column = action.column;
        say(b, `${actor.name} moves to the ${action.row === 0 ? 'front' : 'rear'} row.`);
      }
      return;
    }
    case 'wait':
      return;
  }
}
