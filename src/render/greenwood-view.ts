// What an Elementalist with a tree spell can do (docs/rules-adaptation.md, Elementalist tree
// spells), as data for the panel. Pure.
import type { GameData } from '../game/character/context.ts';
import { characterSheet } from '../game/character/derived.ts';
import { poolOf } from '../game/world/casting.ts';
import { TREES, treesOf, type TreeSpell } from '../game/world/greenwood.ts';
import type { World } from '../game/world/types.ts';
import { castsLeftText } from './casting-view.ts';

export interface TreeCasterView {
  id: string;
  name: string;
  /** "3 spells left today", or with spell points. */
  left: string;
  /** Each tree spell prepared, and the caster's hurt trees it would mend. */
  spells: { spell: TreeSpell; mend: { id: string; name: string }[] }[];
}

export function greenwoodView(w: World, data: GameData): TreeCasterView[] {
  return w.members.flatMap((m): TreeCasterView[] => {
    const magic = characterSheet(m.character, data).magic;
    const prepared = (Object.keys(TREES) as TreeSpell[]).filter((s) =>
      m.character.spells.prepared.includes(s),
    );
    if (m.dead || !magic || prepared.length === 0) return [];
    return [
      {
        id: m.id,
        name: m.character.name,
        left: castsLeftText(poolOf(m, magic), magic),
        spells: prepared.map((spell) => ({
          spell,
          mend: treesOf(w, m, spell)
            .filter((n) => n.hp < n.maxHp)
            .map((n) => ({ id: n.id, name: n.name })),
        })),
      },
    ];
  });
}
