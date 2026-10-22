// Potions in a fight (docs/rules-adaptation.md, Potions; vendor/wwn-srd/4.0 Magic and
// Spellcasting/4.9.0 Magic Items and Enchanted Treasures.md, 4.9.2): a Readied potion is drunk as a
// Main Action. A healing draught can be poured into an ally in touch, the Mortally Wounded
// included, as Healing Touch reaches (Sam's call); Oil of Edge goes on the drinker's own weapon
// for the rest of the fight. Other potions are for outside fights.
import { roll } from '../../rules/dice.ts';
import { inTouch } from '../../rules/formation.ts';
import type { Character, Potion, PotionEffect } from '../../data/schemas/index.ts';
import { findItem, lineLabel } from '../character/items.ts';
import { takeLine } from '../character/stacks.ts';
import type { Choice, Command } from './commands.ts';
import { bearsHealing } from './healing-strain.ts';
import { say } from './log.ts';
import { restore } from './spells.ts';
import type { Action, Battle, Combatant } from './types.ts';

/** The potion an inventory line holds, if it is one. */
export function potionAt(b: Battle, actor: Combatant, index: number): Potion | null {
  const e = actor.character?.inventory[index];
  const item = e ? findItem(b.data, e.id) : undefined;
  return item?.kind === 'potion' ? item.potion : null;
}

const hurt = (c: Combatant) =>
  c.status === 'dying' || c.status === 'stable' || (c.status !== 'dead' && c.hp < c.maxHp);

/** Who a readied potion can go to now: healing to the hurt in touch, oil to the drinker's weapon. */
export function potionTargets(b: Battle, actor: Combatant, index: number): Combatant[] {
  const p = potionAt(b, actor, index);
  if (!p || actor.character?.inventory[index]?.location !== 'readied') return [];
  switch (p.effect.kind) {
    case 'heal': {
      const strain = p.effect.strain;
      return b.combatants.filter(
        (c) =>
          c.side === actor.side &&
          !c.amber &&
          hurt(c) &&
          (c === actor || inTouch(actor, c)) &&
          bearsHealing(c, strain),
      );
    }
    case 'edge':
      return actor.attacks.length > 0 && !actor.edge ? [actor] : [];
    default:
      return [];
  }
}

/** The Drink command: one choice per readied potion and target. */
export function potionCommand(b: Battle, actor: Combatant): Command | null {
  const choices = (actor.character?.inventory ?? []).flatMap((e, item): Choice[] =>
    potionTargets(b, actor, item).map((t) => ({
      label: t === actor ? lineLabel(b.data, e) : `${lineLabel(b.data, e)} to ${t.name}`,
      targetId: t.id,
      action: { kind: 'potion', item, target: t.id },
    })),
  );
  return choices.length > 0 ? { key: 'potion', group: 'gear', label: 'Drink', choices } : null;
}

/** Drinks or gives one dose; nothing happens if the potion can't go to that target now. */
export function drinkPotion(b: Battle, actor: Combatant, index: number, targetId: string): void {
  const target = potionTargets(b, actor, index).find((t) => t.id === targetId);
  if (!target) return;
  // A target means a PC's readied potion line.
  const p = potionAt(b, actor, index) as Potion;
  const c = actor.character as Character;
  actor.character = { ...c, inventory: takeLine(c.inventory, index, 1).rest };
  const effect = p.effect;
  if (effect.kind === 'heal') {
    const to = target === actor ? 'drinks' : `gives ${target.name}`;
    say(b, `${actor.name} ${to} a ${p.name}.`);
    restore(b, target, roll(b.rng, effect.dice).total, effect.strain);
    return;
  }
  // Only healing and Oil of Edge have targets in a fight.
  const edge = effect as Extract<PotionEffect, { kind: 'edge' }>;
  actor.edge = { hit: edge.hit, damage: edge.damage };
  say(b, `${actor.name} oils their weapon with ${p.name}.`);
}

const healingLines = (b: Battle, actor: Combatant) =>
  (actor.character?.inventory ?? []).flatMap((_, i) =>
    potionAt(b, actor, i)?.effect.kind === 'heal' ? [i] : [],
  );

/**
 * The AI's potion (Sam's call): a readied healing potion poured into the Mortally Wounded `first`
 * when they are in touch, or drunk at a third of the drinker's hit points or less when no ally's
 * magic can heal them. Never Oil of Edge.
 */
export function potionAction(
  b: Battle,
  actor: Combatant,
  first: Combatant | undefined,
  healed: boolean,
): Action | null {
  for (const item of healingLines(b, actor)) {
    const to = potionTargets(b, actor, item);
    if (first && to.includes(first)) return { kind: 'potion', item, target: first.id };
    if (!healed && actor.hp * 3 <= actor.maxHp && to.includes(actor))
      return { kind: 'potion', item, target: actor.id };
  }
  return null;
}
