// Who a Healer in the party can purge of Frailty (Purge Ailment), as data for the panel. Pure.
import type { GameData } from '../game/character/context.ts';
import { characterSheet } from '../game/character/derived.ts';
import { awake } from '../game/world/members.ts';
import { frailAllies, PURGE } from '../game/world/purge.ts';
import type { World } from '../game/world/types.ts';

export interface PurgeView {
  healers: {
    id: string;
    name: string;
    effortLeft: number;
    frail: { id: string; name: string }[];
  }[];
}

/** The party's conscious Healers with Purge Ailment and a Frail ally to tend, or null. */
export function purgeView(w: World, data: GameData): PurgeView | null {
  const healers = w.members.flatMap((m) => {
    const c = m.character;
    if (!awake(m) || !c.arts.includes(PURGE)) return [];
    const frail = frailAllies(w, m.id).map((x) => ({ id: x.id, name: x.character.name }));
    if (frail.length === 0) return [];
    // Anyone with an art has magic.
    const effort = (characterSheet(c, data).magic as { effort: number }).effort;
    return [{ id: m.id, name: c.name, effortLeft: Math.max(0, effort - m.effortDay), frail }];
  });
  return healers.length > 0 ? { healers } : null;
}
