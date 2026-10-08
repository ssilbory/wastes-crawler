// Who can give an antidote, and to whom, as data for the panel (docs/rules-adaptation.md, Poison
// and disease). Pure.
import type { GameData } from '../game/character/context.ts';
import { antidoteGivers } from '../game/world/antidote.ts';
import { alive } from '../game/world/members.ts';
import type { World } from '../game/world/types.ts';

export interface AntidoteView {
  givers: { id: string; name: string; doses: number | null }[];
  poisoned: { id: string; name: string }[];
}

/** The givers (doses carried, or null for a Poisoner's own remedy) and the Poisoned, or null. */
export function antidoteView(w: World, data: GameData): AntidoteView | null {
  const poisoned = alive(w)
    .filter((m) => m.poisoned)
    .map((m) => ({ id: m.id, name: m.character.name }));
  const id = data.content.ailments.antidote.id;
  const givers = antidoteGivers(w, data).map((m) => {
    const poisoner = m.character.foci.some((f) => f.id === 'poisoner' && f.level >= 2);
    const doses = m.character.inventory
      .filter((e) => e.id === id)
      .reduce((n, e) => n + e.quantity, 0);
    return { id: m.id, name: m.character.name, doses: poisoner ? null : doses };
  });
  return poisoned.length > 0 && givers.length > 0 ? { givers, poisoned } : null;
}
