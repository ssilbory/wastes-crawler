// Items that hold spells (docs/rules-adaptation.md, Potions, scrolls, and magic devices): a scroll
// holds one spell (SRD 4.9.1), a wand one and a staff two or three with charges (4.9.4), all at
// their maker's caster level. Rods and everything else hold none.
import { gameSpells, type GameSpell } from '../../data/spells.ts';
import type { GameData } from './context.ts';
import type { CatalogItem, InventoryEntry } from './items.ts';

/** The spells a line holds, by id: a scroll's one, or a device's. */
export const heldSpells = (e: InventoryEntry): string[] => (e.spell ? [e.spell] : (e.spells ?? []));

/** A held spell; character loading keeps held spells to game spells. */
export const heldSpell = (data: GameData, id: string) =>
  gameSpells(data.srd, data.content).find((s) => s.id === id) as GameSpell;

/** What is wrong with the spells a line holds for its item, or null. */
export function spellLineProblem(
  data: GameData,
  item: CatalogItem,
  e: InventoryEntry,
): string | null {
  const known = (id: string) => gameSpells(data.srd, data.content).some((s) => s.id === id);
  const d = item.kind === 'device' ? item.device.device : null;
  if (item.kind === 'scroll')
    return e.spell && !e.spells && !e.charges && e.casterLevel && known(e.spell)
      ? null
      : 'a scroll needs one known spell and a caster level';
  if (d && d.kind !== 'rod') {
    const spells = e.spells ?? [];
    const count = d.kind === 'wand' ? [1, 1] : [d.minSpells, d.maxSpells];
    const fits =
      !e.spell &&
      spells.length >= (count[0] as number) &&
      spells.length <= (count[1] as number) &&
      spells.every(known) &&
      e.casterLevel &&
      e.charges;
    return fits ? null : `a ${item.name.toLowerCase()} needs its spells, caster level, and charges`;
  }
  return e.spell || e.spells || e.casterLevel || e.charges ? `${item.id} can't hold a spell` : null;
}
