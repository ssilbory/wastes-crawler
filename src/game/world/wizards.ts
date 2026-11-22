// Wizards (docs/rules-adaptation.md, Potions, scrolls, and magic devices: Wizards; Sam's calls): a
// wizard takes one of a settlement's crafter places (Crafters). Each month a wizard has a few
// ready-made scrolls, wands, staves, and rods of their tradition, drawn when the party calls on them,
// at four times their order price; and they make any of them to order at the full making price, a
// scroll in a week and a device in a month (vendor/wwn-srd/4.0 Magic and Spellcasting/4.10.0
// Creating Magic Items.md), to be collected in their town. What they make goes off at their caster
// level. Purchases and orders are town purchases, through the spending threshold (wizard-wares.ts
// has what they make and its prices).
import type { Device, Wizard, WizardPiece, WizardState } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { putLine } from '../character/stacks.ts';
import { builtWizard } from './built-services.ts';
import { partsText, pickComponents, removeComponents } from './components.ts';
import { deviceLine } from './enchanting.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import { currentTown, priceHere, spend, townHere } from './town-prices.ts';
import type { Member, World } from './types.ts';
import {
  drawWizardPiece,
  pieceKind,
  wizardMisfit,
  wizardPieceName,
  wizardStockPrice,
  wizardTerms,
} from './wizard-wares.ts';
import { daysText } from './wording.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

export function wizardHere(w: World, data: GameData): Wizard | undefined {
  const town = currentTown(w, data);
  if (!town) return undefined;
  return (
    data.content.wizards.wizards.find((x) => x.town === town.id) ?? builtWizard(w, data, town.id)
  );
}

/** This month's state, or null before the party has called on them this month. */
export function wizardState(w: World, data: GameData, wz: Wizard): WizardState | null {
  const st = w.wizards[wz.id];
  return st && w.day - st.since < data.content.overlandRules.daysPerMonth ? st : null;
}

/** Calls on the settlement's wizard, drawing the month's stock if it is new. */
export function visitWizard(w: World, data: GameData): TownResult {
  const wz = wizardHere(w, data);
  if (!wz) return no(`No wizard works in ${townHere(w, data).name}.`);
  if (wizardState(w, data, wz)) return { ok: true };
  const stock: WizardPiece[] = [];
  for (let i = w.rng.int(0, data.content.wizards.maxStock); i > 0; i--) {
    const piece = drawWizardPiece(w, data, wz);
    if (piece) stock.push(piece);
  }
  w.wizards[wz.id] = { since: w.day, stock };
  return { ok: true };
}

function open(w: World, data: GameData): { wz: Wizard; st: WizardState } | TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const wz = wizardHere(w, data);
  if (!wz) return no(`No wizard works in ${townHere(w, data).name}.`);
  const st = wizardState(w, data, wz);
  if (!st) return no(`Call on ${wz.name} first.`);
  return { wz, st };
}

function member(w: World, id: string): Member {
  const m = w.members.find((x) => x.id === id && !x.dead);
  if (!m) throw new Error(`no living party member ${id}`);
  return m;
}

/** Puts a wizard's piece in a member's pack, going off at the wizard's level. */
function give(w: World, data: GameData, m: Member, wz: Wizard, piece: WizardPiece): void {
  const line =
    pieceKind(data, piece.item) === 'scroll'
      ? {
          id: piece.item,
          quantity: 1,
          location: 'stowed' as const,
          spell: piece.spells[0] as string,
          casterLevel: wz.level,
        }
      : deviceLine(
          w,
          data.content.devices.devices.find((d) => d.id === piece.item) as Device,
          piece.spells,
          wz.level,
        );
  m.character = { ...m.character, inventory: putLine(m.character.inventory, line) };
}

/** Buys a ready-made piece from the month's stock. */
export function buyWizardPiece(
  w: World,
  data: GameData,
  index: number,
  memberId: string,
): TownResult {
  const shop = open(w, data);
  if ('ok' in shop) return shop;
  const { wz, st } = shop;
  const piece = st.stock[index];
  if (!piece) throw new Error(`no stock line ${index}`);
  const m = member(w, memberId);
  const listed = wizardStockPrice(data, piece);
  if (!spend(w, data, listed)) return no(`That costs ${priceHere(w, data, listed)} crowns.`);
  st.stock = st.stock.filter((_, i) => i !== index);
  give(w, data, m, wz, piece);
  note(w, `${m.character.name} buys a ${wizardPieceName(data, piece)} from ${wz.name}.`);
  return { ok: true };
}

/** Orders a scroll, wand, staff, or rod the wizard can make, paid now. */
export function orderWizardPiece(w: World, data: GameData, piece: WizardPiece): TownResult {
  const shop = open(w, data);
  if ('ok' in shop) return shop;
  const { wz } = shop;
  const misfit = wizardMisfit(data, wz, piece);
  if (misfit) return no(misfit);
  const terms = wizardTerms(data, piece);
  const parts = pickComponents(w, data, terms.components);
  if (!parts) return no(`It needs ${partsText(terms.components)}.`);
  if (!spend(w, data, terms.crowns))
    return no(`${wz.name} asks ${priceHere(w, data, terms.crowns)} crowns.`);
  removeComponents(w, parts);
  w.wizardOrders.push({ wizard: wz.id, ...piece, readyDay: w.day + terms.days });
  note(
    w,
    `${wz.name} takes on a ${wizardPieceName(data, piece)}: ready in ${daysText(terms.days)}.`,
  );
  return { ok: true };
}

/** Collects a finished order in its wizard's settlement. */
export function collectWizardPiece(
  w: World,
  data: GameData,
  index: number,
  memberId: string,
): TownResult {
  const shop = open(w, data);
  if ('ok' in shop) return shop;
  const order = w.wizardOrders[index];
  if (!order || order.wizard !== shop.wz.id) throw new Error(`no order ${index} here`);
  if (w.day < order.readyDay) return no(`Not ready for ${daysText(order.readyDay - w.day)}.`);
  const m = member(w, memberId);
  w.wizardOrders = w.wizardOrders.filter((_, i) => i !== index);
  const piece = { item: order.item, spells: order.spells };
  give(w, data, m, shop.wz, piece);
  note(w, `${m.character.name} collects the ${wizardPieceName(data, piece)} from ${shop.wz.name}.`);
  return { ok: true };
}
