// Who a Healer in the party can tend with Purge Ailment, as data for the panel: allies who are
// Frail (Sam's call), Poisoned, or sick (1.5.9). Pure.
import type { GameData } from '../game/character/context.ts';
import { characterSheet } from '../game/character/derived.ts';
import { findDisease } from '../game/world/ailing.ts';
import { awake } from '../game/world/members.ts';
import { frailAllies, PURGE, sickAllies } from '../game/world/purge.ts';
import type { World } from '../game/world/types.ts';

export type Ailment = 'frailty' | 'poison' | 'disease';

export interface PurgeView {
  healers: {
    id: string;
    name: string;
    effortLeft: number;
    tend: { id: string; name: string; ailment: Ailment; label: string }[];
  }[];
}

/** The party's conscious Healers with Purge Ailment and an ally to tend, or null. */
export function purgeView(w: World, data: GameData): PurgeView | null {
  const healers = w.members.flatMap((m) => {
    const c = m.character;
    if (!awake(m) || !c.arts.includes(PURGE)) return [];
    const tend = [
      ...frailAllies(w, m.id).map((x) => ({ x, ailment: 'frailty' as const, label: 'Frailty' })),
      ...sickAllies(w, m.id, 'poison').map((x) => ({
        x,
        ailment: 'poison' as const,
        label: 'poison',
      })),
      ...sickAllies(w, m.id, 'disease').map((x) => ({
        x,
        ailment: 'disease' as const,
        // sickAllies only returns members who have a disease.
        label: findDisease(data, (x.disease as { id: string }).id).name,
      })),
    ].map(({ x, ailment, label }) => ({ id: x.id, name: x.character.name, ailment, label }));
    if (tend.length === 0) return [];
    // Anyone with an art has magic.
    const effort = (characterSheet(c, data).magic as { effort: number }).effort;
    return [{ id: m.id, name: c.name, effortLeft: Math.max(0, effort - m.effortDay), tend }];
  });
  return healers.length > 0 ? { healers } : null;
}
