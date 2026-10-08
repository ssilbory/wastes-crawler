// What each Beastmaster in the party can do with a companion outside a fight (1.5.4), for the
// panel. Pure.
import type { GameData } from '../game/character/context.ts';
import { beastmasters, bindable, bindProblem, companionOf } from '../game/world/companions.ts';
import { artUsable } from '../game/world/members.ts';
import { monsterOf } from '../game/world/npcs.ts';
import type { World } from '../game/world/types.ts';

export interface CompanionView {
  name: string;
  /** The kind of beast, and its hit dice now. */
  kind: string;
  hitDice: number;
  hp: number;
  maxHp: number;
  where: 'party' | 'away' | 'dawn';
  chosen: boolean;
}

export interface BeastmasterView {
  id: string;
  name: string;
  companion: CompanionView | null;
  /** Why no beast can be bound now, or null; and those that can be. */
  bindBlocked: string | null;
  beasts: { id: string; name: string; hitDice: number }[];
  /** Swift Healing has Effort to spend and a hurt companion with the party to spend it on. */
  canHeal: boolean;
}

export function companionsView(w: World, data: GameData): BeastmasterView[] {
  return beastmasters(w).map((m) => {
    const n = companionOf(w, m);
    const here = n !== null && m.companion !== n;
    const companion: CompanionView | null = n && {
      name: n.name,
      kind: monsterOf(data, n.type).name,
      hitDice: n.hitDice ?? monsterOf(data, n.type).hitDice,
      hp: n.hp,
      maxHp: n.maxHp,
      where: here ? 'party' : n.hp > 0 ? 'away' : 'dawn',
      chosen: n.chosen === true,
    };
    return {
      id: m.id,
      name: m.character.name,
      companion,
      bindBlocked: bindProblem(w, data, m),
      beasts: bindable(w, data, m).map((id) => {
        const beast = monsterOf(data, id);
        return { id, name: beast.name, hitDice: beast.hitDice };
      }),
      canHeal: here && n.hp > 0 && n.hp < n.maxHp && artUsable(data, m, 'swift-healing'),
    };
  });
}
