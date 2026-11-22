// What a smith makes, to order or ready-made (docs/rules-adaptation.md, Crafting and modifying
// gear: Craftsmen; Sam's calls). Like a PC with Craft (vendor/wwn-srd/2.0 The Rules of the
// Game/2.8.0 Crafting and Modifying Gear.md), a smith builds any weapon or suit of armor on their
// lists normal or mastercrafted (2.8.1: ten times the cost, twice the time), builds one mod onto it
// of their own Craft level or lower (2.8.2), and makes it +1 to +3 with an ability besides
// (vendor/wwn-srd/4.0 Magic and Spellcasting/4.10.0 Creating Magic Items.md), all at once. A piece
// is a weapon or suit with those choices. Reads only; commissions.ts takes the orders.
import type { Craftsman, Mod } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { toTenths } from '../../rules/economy.ts';
import { buildDays, craftable } from './crafting.ts';
import { forgeTerms, forgedName } from './forging.ts';
import {
  itemOf,
  modById,
  modCrowns,
  modFits,
  ownPrice,
  qualityPrice,
  type Piece,
} from './smith-mods.ts';

export type { Piece };

type Part = { type: Mod['components'][number]['type']; count: number };
export interface Terms {
  crowns: number;
  components: Part[];
  days: number;
}

/** Why a smith can't make a piece, or null if they can. */
export function pieceMisfit(data: GameData, c: Craftsman, piece: Piece): string | null {
  if (![...c.weapons, ...c.armor].includes(piece.weapon))
    return `${c.name} doesn't make a ${itemOf(data, piece.weapon).name}.`;
  if (piece.ability && piece.bonus === undefined) return 'Only magic gear takes an ability.';
  if (!piece.mod) return null;
  const mod = modById(data, piece.mod);
  if (mod.minCraft > c.craft)
    return `${mod.name} needs Craft-${mod.minCraft}; ${c.name} has ${c.craft}.`;
  return modFits(data, piece.weapon, mod) ? null : `${mod.name} doesn't fit it.`;
}

/** A mod's days: a week a Craft level, halved for full-time work (SRD 2.8.2; Mod time). */
const modDays = (data: GameData, mod: Mod) =>
  Math.max(1, Math.ceil((data.content.craftingRules.mods.daysPerLevel * mod.minCraft) / 2));

/**
 * What a piece costs to order: the item at its quality (its parts cost, SRD 2.8.1), plus its mod's
 * dice in crowns and components, plus its bonus's and ability's commission. Time adds up: the build
 * (folded into the magic work, as a forging's), the mod, and the magic.
 */
export function pieceTerms(data: GameData, piece: Piece): Terms {
  const it = craftable(data).find((x) => x.id === piece.weapon);
  if (!it) throw new Error(`${piece.weapon} isn't built`);
  const build = buildDays(data, it, piece.quality ?? 'normal');
  const plainBuild = buildDays(data, it, 'normal');
  const own = qualityPrice(data, piece);
  const magic = piece.bonus ? forgeTerms(data, piece.weapon, piece.bonus, piece.ability) : null;
  const mod = piece.mod ? modById(data, piece.mod) : null;
  return {
    crowns: toTenths(
      own + (magic ? magic.crowns - ownPrice(data, piece.weapon) : 0) + (mod ? modCrowns(mod) : 0),
    ),
    components: [...(magic?.components ?? []), ...(mod?.components ?? [])],
    days: (magic ? magic.days + build - plainBuild : build) + (mod ? modDays(data, mod) : 0),
  };
}

/** "mastercrafted long sword +1 (Flaming) with Razor Edge", for lists and the journal. */
export function pieceName(data: GameData, piece: Piece): string {
  const base = forgedName(data, piece.weapon, piece.ability);
  const bonus = piece.bonus ? ` +${piece.bonus}` : '';
  const named = piece.ability ? base.replace(' (', `${bonus} (`) : `${base}${bonus}`;
  const mod = piece.mod ? ` with ${modById(data, piece.mod).name}` : '';
  return `${piece.quality ? 'mastercrafted ' : ''}${named}${mod}`;
}
