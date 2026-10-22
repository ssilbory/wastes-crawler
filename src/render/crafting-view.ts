// Text for crafting under way. Pure reads of game state.
import type { Project, Site } from '../data/schemas/index.ts';
import { gameSpells, type GameSpell } from '../data/spells.ts';
import type { GameData } from '../game/character/context.ts';
import { findItem, type CatalogItem } from '../game/character/items.ts';
import { daysText, tierName } from '../game/world/crafting.ts';
import type { Member, World } from '../game/world/types.ts';

/** "Snag: mastercrafted Spear, 3 days left, at the workshop in Rubblegate". */
export function projectText(w: World, data: GameData, p: Project): string {
  // Projects only ever name members, items, and towns that exist.
  const crafter = [...w.members, ...w.benched].find((m) => m.id === p.crafter) as Member;
  const item = (findItem(data, p.item) as CatalogItem).name;
  const town = data.content.regions.flatMap((r) => r.sites).find((s) => s.id === p.town) as Site;
  const days = `${daysText(p.daysLeft)} left`;
  const where = p.staying ? `, at the workshop in ${town.name}` : '';
  const mod = data.content.mods.find((m) => m.id === p.mod)?.name;
  const work =
    p.kind === 'mod'
      ? `${mod} on the ${item}`
      : p.kind === 'strip'
        ? `stripping ${mod} off the ${item}`
        : p.kind === 'brew'
          ? `brewing ${p.doses as number} × ${item}`
          : p.kind === 'scribe'
            ? `writing a scroll of ${(gameSpells(data.srd, data.content).find((s) => s.id === p.spell) as GameSpell).name}`
            : `${tierName(p.quality)}${item}${p.small ? ' (small)' : ''}`;
  return `${crafter.character.name}: ${work}, ${days}${where}`;
}
