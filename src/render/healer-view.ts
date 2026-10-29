// Who a Healer in the party can revive (Phase 14d), as data for the panel. Pure.
import type { GameData } from '../game/character/context.ts';
import { characterSheet } from '../game/character/derived.ts';
import { cannotUseArt, fallenHere, REVIVE, REVIVE_ART } from '../game/world/healer.ts';
import type { World } from '../game/world/types.ts';

export interface HealerView {
  /** `unable` is why the Healer can't revive anyone now (no Effort, armor), or null. */
  healers: { id: string; name: string; effortLeft: number; unable: string | null }[];
  fallen: { id: string; name: string }[];
}

/** The party's conscious Healers with Revive the Fallen, and the fallen they could revive here. */
export function healerView(w: World, data: GameData): HealerView | null {
  const fallen = fallenHere(w).map((m) => ({ id: m.id, name: m.character.name }));
  const healers = w.members.flatMap((m) => {
    const c = m.character;
    if (m.dead || c.hp.current <= 0 || !c.arts.includes(REVIVE)) return [];
    // Anyone with an art has magic.
    const effort = (characterSheet(c, data, m.form).magic as { effort: number }).effort;
    return [
      {
        id: m.id,
        name: c.name,
        effortLeft: Math.max(0, effort - m.effortDay),
        // The same check reviving makes, so the panel never offers what would be refused.
        unable: cannotUseArt(data, m, REVIVE_ART),
      },
    ];
  });
  return healers.length > 0 && fallen.length > 0 ? { healers, fallen } : null;
}

/** True when a Healer here can revive someone now: worth asking before moving on. */
export const reviveOffered = (view: HealerView | null): boolean =>
  !!view && view.healers.some((h) => !h.unable);

/** The warning before the party leaves its fallen: "Snag is gone for good" and the like. */
export function leavingWarning(view: HealerView): string {
  const names = view.fallen.map((f) => f.name);
  const who =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `Once the party moves on, ${who} ${names.length === 1 ? 'is' : 'are'} gone for good.`;
}
