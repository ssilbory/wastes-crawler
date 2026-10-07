// Boneshaper (vendor/wwn-srd/4.0 Magic and Spellcasting/4.6.0 Necromancer Spells.md; Sam's call,
// docs/rules-adaptation.md, Necromancer spells outside fights): an hour's work on a willing member
// adds +1 to the modifier of Charisma or a physical attribute at the cost of −1 to another of them.
// A modifier is never shaped past +2 or below −2, and no attribute's changes pass ±2 in all. It
// lasts until the Necromancer lifts it, which takes no spell.
import type { Attribute, Character } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { cannotCast, spendCast } from './casting.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

export const BONESHAPER = 'boneshaper';

/** Charisma or a physical attribute (SRD). */
export const SHAPEABLE: readonly Attribute[] = ['str', 'dex', 'con', 'cha'];

const MAX_SHIFT = 2;
const MAX_MODIFIER = 2;

const no = (reason: string): TownResult => ({ ok: false, reason });
const find = (w: World, id: string) => w.members.find((x) => x.id === id);

function unshaped(c: Character): Character {
  const out = { ...c };
  delete out.shaped;
  return out;
}

/** Why the caster can't shape now, wherever the party is, or null if they can. */
export function cannotShapeHere(w: World): string | null {
  if (w.encounter) return 'Settle the encounter first.';
  if (w.dungeon || w.coach) return 'Boneshaping takes an hour of quiet work above ground.';
  return null;
}

/** Shapes the target: +1 to one modifier, −1 to another. */
export function boneshape(
  w: World,
  data: GameData,
  casterId: string,
  targetId: string,
  raise: Attribute,
  lower: Attribute,
): TownResult {
  const here = cannotShapeHere(w);
  if (here) return no(here);
  const m = find(w, casterId);
  const why = cannotCast(data, m, BONESHAPER);
  if (why) return no(why);
  const caster = m as Member;
  const target = find(w, targetId);
  if (!target || target.dead) return no('Only a living member can be shaped.');
  const c = target.character;
  const name = c.name;
  if (c.shaped && c.shaped.by !== caster.character.id)
    return no(`${name} is already shaped by another hand.`);
  if (raise === lower || !SHAPEABLE.includes(raise) || !SHAPEABLE.includes(lower))
    return no('Raise one of Strength, Dexterity, Constitution, or Charisma and lower another.');
  const changes = { ...c.shaped?.changes };
  const mods = characterSheet(c, data).modifiers;
  if (mods[raise] >= MAX_MODIFIER || (changes[raise] ?? 0) >= MAX_SHIFT)
    return no(`${name}'s ${raise.toUpperCase()} can be shaped no higher.`);
  if (mods[lower] <= -MAX_MODIFIER || (changes[lower] ?? 0) <= -MAX_SHIFT)
    return no(`${name}'s ${lower.toUpperCase()} can be shaped no lower.`);
  changes[raise] = (changes[raise] ?? 0) + 1;
  changes[lower] = (changes[lower] ?? 0) - 1;
  // A change shaped back to nothing is gone; with none left, so is the shaping.
  const kept = Object.fromEntries(Object.entries(changes).filter(([, n]) => n !== 0));
  spendCast(data, caster, BONESHAPER);
  target.character =
    Object.keys(kept).length > 0
      ? { ...c, shaped: { by: caster.character.id, changes: kept } }
      : unshaped(c);
  note(w, `${caster.character.name} reshapes ${name}'s flesh and bone.`);
  return { ok: true };
}

/** The caster lifts their shaping from the target, which takes no spell. */
export function liftShaping(w: World, casterId: string, targetId: string): TownResult {
  const caster = find(w, casterId);
  const target = find(w, targetId);
  if (!caster || caster.dead || caster.character.hp.current <= 0)
    return no('No one is able to lift that.');
  if (!target?.character.shaped || target.character.shaped.by !== caster.character.id)
    return no(`${caster.character.name} has not shaped them.`);
  target.character = unshaped(target.character);
  note(
    w,
    `${caster.character.name} lets ${target.character.name}'s flesh settle back into its old shape.`,
  );
  return { ok: true };
}
