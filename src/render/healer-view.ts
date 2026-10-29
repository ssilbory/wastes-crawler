// Who a Healer in the party can revive (Phase 14d), as data for the panel. Pure.
import type { GameData } from '../game/character/context.ts';
import { characterSheet } from '../game/character/derived.ts';
import { fallenHere, REVIVE } from '../game/world/healer.ts';
import type { World } from '../game/world/types.ts';

export interface HealerView {
  healers: { id: string; name: string; effortLeft: number }[];
  fallen: { id: string; name: string }[];
}

/** The party's conscious Healers with Revive the Fallen, and the fallen they could revive here. */
export function healerView(w: World, data: GameData): HealerView | null {
  const fallen = fallenHere(w).map((m) => ({ id: m.id, name: m.character.name }));
  const healers = w.members.flatMap((m) => {
    const c = m.character;
    if (m.dead || c.hp.current <= 0 || !c.arts.includes(REVIVE)) return [];
    // Anyone with an art has magic.
    const effort = (characterSheet(c, data).magic as { effort: number }).effort;
    return [{ id: m.id, name: c.name, effortLeft: Math.max(0, effort - m.effortDay) }];
  });
  return healers.length > 0 && fallen.length > 0 ? { healers, fallen } : null;
}

/** True when a Healer still has the Effort to revive someone here: worth asking before moving on. */
export const reviveOffered = (view: HealerView | null): boolean =>
  !!view && view.healers.some((h) => h.effortLeft > 0);
