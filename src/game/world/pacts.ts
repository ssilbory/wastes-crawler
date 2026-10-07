// Pact of Stone and Sea (vendor/wwn-srd/4.0 Magic and Spellcasting/4.5.0 Elementalist Spells.md;
// Sam's call, docs/rules-adaptation.md, Elementalist spells outside fights): a living member chosen
// by the caster is immune to harm from one element for the rest of the scene. In the game the scene
// lasts until the end of the next fight, until the party moves to another dungeon level or comes
// out of the dungeon, or until the day ends. It wards off traps and breath of that element.
import type { Element } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { cannotCast } from './casting.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

export const PACT = 'pact-of-stone-and-sea';
export const ELEMENTS: readonly Element[] = ['earth', 'water', 'fire', 'wind'];

const no = (reason: string): TownResult => ({ ok: false, reason });

/** The scene's place: the dungeon level the party is on, or the surface. */
const scene = (w: World) => (w.dungeon ? `${w.dungeon.dungeon}/${w.dungeon.level}` : 'surface');

const current = (w: World) =>
  w.pacts !== null && w.pacts.at === scene(w) && w.pacts.day === w.day ? w.pacts : null;

/** The element a member is pacted against now, if any. */
export const pactOf = (w: World, memberId: string): Element | undefined => current(w)?.by[memberId];

/** Pact of Stone and Sea on a living member, the caster included. */
export function makePact(
  w: World,
  data: GameData,
  casterId: string,
  targetId: string,
  element: Element,
): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const m = w.members.find((x) => x.id === casterId);
  const why = cannotCast(data, m, PACT);
  if (why) return no(why);
  const target = w.members.find((x) => x.id === targetId);
  if (!target || target.dead) return no('Only a living member can be pacted.');
  if (!ELEMENTS.includes(element)) return no('Choose earth, water, fire, or wind.');
  (m as Member).spellsCast += 1;
  w.pacts = { at: scene(w), day: w.day, by: { ...current(w)?.by, [targetId]: element } };
  note(
    w,
    `${(m as Member).character.name} binds ${target.character.name} in a pact with ${element}.`,
  );
  return { ok: true };
}

/** A fight ends the scene, and every pact with it. */
export function endPacts(w: World): void {
  w.pacts = null;
}
