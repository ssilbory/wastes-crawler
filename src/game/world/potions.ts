// Potions outside fights (docs/rules-adaptation.md, Potions; vendor/wwn-srd/4.0 Magic and
// Spellcasting/4.9.0 Magic Items and Enchanted Treasures.md, 4.9.2). Out of a fight there is time
// to dig one out of the pack, so a potion is drunk from anywhere on the holder, or given to another
// member. Healing adds System Strain as a potion (SRD 2.5.2) and is refused past the maximum; a
// Restorative Tonic eases strain even while Hungry, Sleepless, or Cold; a Waking Tonic lifts
// Sleepless and Cold; a Shadow Draught lets the party slip away from a group that spotted it first,
// as The Excellent Transpicuous Transformation does. Oil of Edge is for fights only. Tabula Rasa
// (Sam's call) takes the drinker back to 1st level, with the picks made anew (tabula-rasa.ts).
import type { Potion } from '../../data/schemas/index.ts';
import { roll } from '../../rules/dice.ts';
import { addStrain } from '../../rules/strain.ts';
import type { Choices } from '../character/creation.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { findItem } from '../character/items.ts';
import { takeLine } from '../character/stacks.ts';
import { wipeClean } from '../character/tabula-rasa.ts';
import { alive, awake, note, setHp } from './members.ts';
import { settleByLeaving } from './quarter.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

export const potionOf = (data: GameData, id: string): Potion | null => {
  const item = findItem(data, id);
  return item?.kind === 'potion' ? item.potion : null;
};

/** The potions a member carries, by id, with how many. */
export function carried(data: GameData, m: Member): { potion: Potion; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of m.character.inventory)
    if (potionOf(data, e.id)) counts.set(e.id, (counts.get(e.id) ?? 0) + e.quantity);
  return [...counts].map(([id, count]) => ({ potion: potionOf(data, id) as Potion, count }));
}

/** Why the potion can't go to the target now, or null if it can. */
export function cannotDrink(w: World, data: GameData, p: Potion, target: Member): string | null {
  const e = p.effect;
  const c = target.character;
  if (e.kind === 'edge') return `${p.name} is for fights.`;
  if (e.kind === 'vanish') {
    const enc = w.encounter;
    if (!enc) return 'There is no one to slip away from.';
    return !enc.hostile || enc.spotted ? 'The party can leave without it.' : null;
  }
  if (w.encounter) return 'Settle the encounter first.';
  if (e.kind === 'tabula-rasa') return null;
  if (e.kind === 'heal') {
    if (c.hp.current >= c.hp.max) return `${c.name} is unhurt.`;
    const max = characterSheet(c, data).strainMax;
    const state = { strain: c.strain.value, max, broken: c.strain.broken };
    return addStrain(state, e.strain, 'potion').kind === 'refused'
      ? `${c.name} can't bear the strain.`
      : null;
  }
  if (e.kind === 'ease-strain') return c.strain.value > 0 ? null : `${c.name} bears no strain.`;
  return target.sleepless || target.cold ? null : `${c.name} is neither Sleepless nor Cold.`;
}

/**
 * One dose from the holder, given to the target (the holder themselves, or anyone for vanish).
 * Tabula Rasa takes the target's new 1st-level picks with it.
 */
export function drink(
  w: World,
  data: GameData,
  holderId: string,
  potionId: string,
  targetId: string,
  picks?: Choices,
): TownResult {
  const holder = alive(w).find((m) => m.id === holderId && awake(m));
  if (!holder) return no('Only a conscious member can hand out a potion.');
  const target = alive(w).find((m) => m.id === targetId);
  if (!target) throw new Error(`no living party member ${targetId}`);
  const p = potionOf(data, potionId);
  if (!p) throw new Error(`${potionId} is not a potion`);
  const index = holder.character.inventory.findIndex((e) => e.id === potionId);
  if (index < 0) return no(`${holder.character.name} carries no ${p.name}.`);
  const why = cannotDrink(w, data, p, target);
  if (why) return no(why);
  if (p.effect.kind === 'tabula-rasa') {
    if (!picks) return no(`Choose ${target.character.name}'s new picks first.`);
    const made = wipeClean(data, target.character, picks, w.rng);
    if (!made.ok) return no(made.errors.join('; '));
    take(holder, index);
    // The pack as it is now: without the dose, when they drank their own.
    target.character = { ...made.character, inventory: target.character.inventory };
    // What came of the old picks goes with them: a form taken, arts' uses today.
    target.form = null;
    target.artUses = {};
    const who =
      holder === target
        ? `${target.character.name} drinks`
        : `${holder.character.name} gives ${target.character.name}`;
    note(w, `${who} ${p.name}, and is 1st level again, with XP to level back up.`);
    return { ok: true };
  }
  take(holder, index);
  apply(w, data, p, holder, target);
  return { ok: true };
}

/** One dose from the holder's line. */
function take(holder: Member, index: number): void {
  holder.character = {
    ...holder.character,
    inventory: takeLine(holder.character.inventory, index, 1).rest,
  };
}

function apply(w: World, data: GameData, p: Potion, holder: Member, target: Member): void {
  const e = p.effect;
  const c = target.character;
  const who = holder === target ? `${c.name} drinks` : `${holder.character.name} gives ${c.name}`;
  if (e.kind === 'vanish') {
    note(w, `${holder.character.name} passes round a ${p.name}; the party fades to grey.`);
    (w.encounter as NonNullable<World['encounter']>).spotted = true;
    settleByLeaving(w, data);
    return;
  }
  if (e.kind === 'heal') {
    const max = characterSheet(c, data).strainMax;
    const outcome = addStrain(
      { strain: c.strain.value, max, broken: c.strain.broken },
      e.strain,
      'potion',
    );
    const strain = { value: outcome.state.strain, broken: outcome.state.broken };
    target.character = { ...c, strain };
    if (outcome.kind === 'dead') {
      target.dead = true;
      note(w, `${c.name}'s body gives out under the strain.`);
      return;
    }
    const healed = Math.max(0, roll(w.rng, e.dice).total);
    setHp(target, Math.min(c.hp.max, c.hp.current + healed));
    note(w, `${who} a ${p.name}: ${healed} HP.`);
    return;
  }
  if (e.kind === 'ease-strain') {
    const value = Math.max(0, c.strain.value - e.amount);
    target.character = { ...c, strain: { ...c.strain, value } };
    note(w, `${who} a ${p.name}; the strain eases.`);
    return;
  }
  // What is left is a Waking Tonic: Oil of Edge never gets past cannotDrink, and Tabula Rasa
  // never reaches here (drink).
  target.sleepless = false;
  target.cold = false;
  note(w, `${who} a ${p.name}, and is wide awake and warm.`);
}
