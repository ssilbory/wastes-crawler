// What the party can do with the dead where it stands, for the question asked over the view
// before it moves on (Sam's call): Query the Skull, or raise them. Pure.
import type { GameData } from '../game/character/context.ts';
import { cannotCast } from '../game/world/casting.ts';
import { cannotRaise, cannotRaiseKnight } from '../game/world/necromancy.ts';
import { QUERY_THE_SKULL } from '../game/world/skull.ts';
import type { World } from '../game/world/types.ts';
import { necromancyView, type CasterView } from './necromancy-view.ts';

export interface DeadOffer {
  corpses: number;
  /** Casters who can question the dead here now. */
  query: CasterView[];
  /** Casters who can raise one of them now, as a zombie or skeleton, or as a Grave Knight. */
  raise: { caster: CasterView; corpse: boolean; knight: boolean }[];
}

/**
 * The corpses here and who has the means to use them now, or null when there are none, an
 * encounter is up, or no one can: not prepared, out of spells, the dead already questioned or too
 * long gone, no more raised dead to keep, no room in the party.
 */
export function deadOffer(w: World, data: GameData): DeadOffer | null {
  if (w.encounter) return null;
  const view = necromancyView(w, data);
  if (!view || view.corpses === 0) return null;
  const member = (id: string) => w.members.find((m) => m.id === id);
  const query = view.casters.filter(
    (c) =>
      c.query !== null &&
      c.query.bar === null &&
      c.query.questions.length > 0 &&
      cannotCast(data, member(c.id), QUERY_THE_SKULL) === null,
  );
  const raise = view.casters
    .map((caster) => ({
      caster,
      corpse: caster.raise && cannotRaise(w, data, member(caster.id)) === null,
      knight: caster.knight && cannotRaiseKnight(w, data, member(caster.id)) === null,
    }))
    .filter((r) => r.corpse || r.knight);
  return query.length > 0 || raise.length > 0 ? { corpses: view.corpses, query, raise } : null;
}
