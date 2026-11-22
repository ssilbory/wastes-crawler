// Commissions (docs/rules-adaptation.md, Crafting and modifying gear: Craftsmen; Sam's calls). A
// craftsman makes a weapon or suit of armor from their lists to order, as a PC with Craft would
// (vendor/wwn-srd/2.0 The Rules of the Game/2.8.0 Crafting and Modifying Gear.md): normal or
// mastercrafted (2.8.1), with one mod of their Craft level or lower (2.8.2), and +1 to +3 with an
// ability besides (4.9.3) for a fiftieth of the SRD's creation cost (vendor/wwn-srd/4.0 Magic and
// Spellcasting/4.10.0). The party pays the crowns and the components up front, and collects the
// piece in the craftsman's town once its days are up (smith-work.ts has the terms).
import type { GameData } from '../character/context.ts';
import { pickComponents, removeComponents } from './components.ts';
import { givePiece, openCraftsman, partyMember, payCraftsman } from './craftsmen.ts';
import { abilitiesFor } from './forging.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import { pieceMisfit, pieceName, pieceTerms, type Piece } from './smith-work.ts';
import type { World } from './types.ts';
import { daysText } from './wording.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Commissions a piece: its quality, mod, bonus, and ability as asked, each for its terms. */
export function commission(w: World, data: GameData, piece: Piece): TownResult {
  const shop = openCraftsman(w, data);
  if ('ok' in shop) return shop;
  const { c, st } = shop;
  const misfit = pieceMisfit(data, c, piece);
  if (misfit) return no(misfit);
  if (piece.ability && !abilitiesFor(data, piece.weapon).some((a) => a.id === piece.ability))
    throw new Error(`${piece.ability} doesn't fit ${piece.weapon}`);
  const terms = pieceTerms(data, piece);
  const parts = pickComponents(w, data, terms.components);
  const name = pieceName(data, piece);
  if (!parts)
    return no(`A ${name} needs ${terms.components.map((x) => `${x.count} ${x.type}`).join(', ')}.`);
  if (!payCraftsman(w, data, c, st, terms.crowns))
    return no(`${c.name} asks ${terms.crowns} crowns.`);
  removeComponents(w, parts);
  w.commissions.push({ craftsman: c.id, ...piece, readyDay: w.day + terms.days });
  note(w, `${c.name} takes on a ${name}: ready in ${daysText(terms.days)}.`);
  return { ok: true };
}

/** Collects a finished commission in its craftsman's town. */
export function collect(w: World, data: GameData, index: number, memberId: string): TownResult {
  const shop = openCraftsman(w, data);
  if ('ok' in shop) return shop;
  const job = w.commissions[index];
  if (!job || job.craftsman !== shop.c.id) throw new Error(`no commission ${index} here`);
  if (w.day < job.readyDay) return no(`Not ready for ${daysText(job.readyDay - w.day)}.`);
  const m = partyMember(w, memberId);
  w.commissions = w.commissions.filter((_, i) => i !== index);
  const piece: Piece = {
    weapon: job.weapon,
    ...(job.quality ? { quality: job.quality } : {}),
    ...(job.mod ? { mod: job.mod } : {}),
    ...(job.bonus ? { bonus: job.bonus } : {}),
    ...(job.ability ? { ability: job.ability } : {}),
  };
  givePiece(data, m, piece);
  note(w, `${m.character.name} collects the ${pieceName(data, piece)} from ${shop.c.name}.`);
  return { ok: true };
}
