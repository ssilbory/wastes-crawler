// What a wizard makes (docs/rules-adaptation.md, Potions, scrolls, and magic devices: Wizards; Sam's
// calls). A wizard writes scrolls and makes wands, staves, and rods as a PC caster does
// (vendor/wwn-srd/4.0 Magic and Spellcasting/4.9.0 Magic Items and Enchanted Treasures.md, 4.9.1
// and 4.9.4; 4.10.0 Creating Magic Items.md), but only with spells of their own tradition (a
// necromancer only necromancer spells; vendor/wwn-srd/4.0 Magic and Spellcasting/4.4.0, 4.5.0,
// 4.6.0), of a level their caster level reaches on the casting progression
// (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.10 The High Mage.md), and only the
// rods of their tradition. An order costs the item's full price (a scroll's 20 crowns a spell level,
// a device's 100, a rod's own), with a scroll's components; ready-made pieces cost four times that.
// Reads only, but for drawing a month's stock with the world's RNG.
import type { CastingProgression, Device, Wizard, WizardPiece } from '../../data/schemas/index.ts';
import type { GameSpell } from '../../data/spells.ts';
import type { GameData } from '../character/context.ts';
import { findItem, type CatalogItem } from '../character/items.ts';
import { heldSpell } from '../character/spell-items.ts';
import { deviceListed, spellsMisfit } from './enchanting.ts';
import { fightScribable, scribable, scrollListed, scrollParts } from './scribing.ts';
import type { World } from './types.ts';

const rules = (data: GameData) => data.content.wizards;
const scrollId = (data: GameData) => data.content.scrolls.scroll.id;

export type PieceKind = 'scroll' | 'wand' | 'staff' | 'rod';

/** The highest spell level a wizard writes: their level's on the casting progression. */
export function maxSpellLevel(data: GameData, wz: Wizard): number {
  // Content checks keep the progression and the wizard's level on it.
  const p = data.srd['casting-progressions'].find(
    (x) => x.id === rules(data).progression,
  ) as CastingProgression;
  return (p.levels.find((l) => l.level === wz.level) as CastingProgression['levels'][number])
    .maxSpellLevel;
}

/** Spells of the wizard's tradition and reach that fit on a scroll, or in a device. */
export function wizardSpells(data: GameData, wz: Wizard, into: 'scroll' | 'device'): GameSpell[] {
  const top = maxSpellLevel(data, wz);
  return (into === 'scroll' ? scribable(data) : fightScribable(data)).filter(
    (s) => s.tradition === wz.tradition && s.level <= top,
  );
}

const devices = (data: GameData) => data.content.devices.devices;

/** The devices of a kind: the wand, the staff, or the rods of the wizard's tradition. */
export function devicesOf(
  data: GameData,
  wz: Wizard,
  kind: Exclude<PieceKind, 'scroll'>,
): Device[] {
  return devices(data).filter(
    (d) =>
      d.device.kind === kind && (d.device.kind !== 'rod' || d.device.tradition === wz.tradition),
  );
}

export function pieceKind(data: GameData, item: string): PieceKind {
  if (item === scrollId(data)) return 'scroll';
  const d = devices(data).find((x) => x.id === item);
  if (!d) throw new Error(`${item} isn't a scroll or device`);
  return d.device.kind;
}

/** Why a wizard can't make a piece, or null if they can. */
export function wizardMisfit(data: GameData, wz: Wizard, piece: WizardPiece): string | null {
  const kind = pieceKind(data, piece.item);
  if (kind === 'rod')
    return devicesOf(data, wz, 'rod').some((d) => d.id === piece.item)
      ? spellsMisfit(data, deviceOf(data, piece.item), piece.spells)
      : `${wz.name} doesn't make a ${itemName(data, piece.item)}.`;
  const theirs = new Set(
    wizardSpells(data, wz, kind === 'scroll' ? 'scroll' : 'device').map((s) => s.id),
  );
  if (!piece.spells.every((id) => theirs.has(id)))
    return `${wz.name} writes only ${traditionName(wz)} spells up to level ${maxSpellLevel(data, wz)} that fit it.`;
  if (kind === 'scroll') return piece.spells.length === 1 ? null : 'A scroll holds one spell.';
  return spellsMisfit(data, deviceOf(data, piece.item), piece.spells);
}

const deviceOf = (data: GameData, id: string) => devices(data).find((d) => d.id === id) as Device;
const itemName = (data: GameData, id: string) => (findItem(data, id) as CatalogItem).name;

const TRADITION_NAMES: Record<Wizard['tradition'], string> = {
  'high-magic': 'high magic',
  elementalist: 'elementalist',
  necromancer: 'necromancer',
};
export const traditionName = (wz: Wizard) => TRADITION_NAMES[wz.tradition];

/** An order's crowns, components, and days: a PC's making price in full (4.9.1, 4.10.0). */
export function wizardTerms(data: GameData, piece: WizardPiece) {
  if (pieceKind(data, piece.item) === 'scroll') {
    const spell = piece.spells[0] as string;
    return {
      crowns: scrollListed(data, spell),
      components: scrollParts(data, spell),
      days: data.content.scrolls.days,
    };
  }
  return {
    crowns: deviceListed(data, piece.item, piece.spells),
    components: [],
    days: data.content.devices.days,
  };
}

/** A ready-made piece's price: its order crowns, times the stock multiplier. */
export const wizardStockPrice = (data: GameData, piece: WizardPiece) =>
  wizardTerms(data, piece).crowns * rules(data).stockMultiplier;

/** "Scroll of Burning Hand", "Staff of A and B", "Rod of Light", for lists and the journal. */
export function wizardPieceName(data: GameData, piece: WizardPiece): string {
  const name = itemName(data, piece.item);
  if (piece.spells.length === 0) return name;
  return `${name} of ${piece.spells.map((id) => heldSpell(data, id).name).join(' and ')}`;
}

/** One random entry; the caller keeps the list non-empty. */
const pick = <T>(w: World, xs: readonly T[]): T => xs[w.rng.int(0, xs.length - 1)] as T;

/**
 * One ready-made piece: its kind by the draw weights, then a spell, two for a staff that fit its
 * levels together, or a rod of their tradition. A draw nothing fits is lost (null).
 */
export function drawWizardPiece(w: World, data: GameData, wz: Wizard): WizardPiece | null {
  const weights = Object.entries(rules(data).draws) as [PieceKind, number][];
  let roll = w.rng.int(
    1,
    weights.reduce((n, [, x]) => n + x, 0),
  );
  const kind = (weights.find(([, x]) => (roll -= x) <= 0) as [PieceKind, number])[0];
  if (kind === 'scroll') {
    const spells = wizardSpells(data, wz, 'scroll');
    return spells.length > 0 ? { item: scrollId(data), spells: [pick(w, spells).id] } : null;
  }
  const [d] = devicesOf(data, wz, kind);
  if (!d) return null;
  if (d.device.kind === 'rod') return { item: pick(w, devicesOf(data, wz, 'rod')).id, spells: [] };
  const dev = d.device;
  const spells = wizardSpells(data, wz, 'device');
  if (dev.kind === 'wand') {
    const fit = spells.filter((s) => s.level <= dev.maxSpellLevel);
    return fit.length > 0 ? { item: d.id, spells: [pick(w, fit).id] } : null;
  }
  // A staff: a first spell, then a second that keeps both within its levels.
  const first = spells.filter((s) =>
    spells.some((t) => t !== s && s.level + t.level <= dev.maxLevels),
  );
  if (first.length === 0) return null;
  const a = pick(w, first);
  const b = pick(
    w,
    spells.filter((t) => t !== a && a.level + t.level <= dev.maxLevels),
  );
  return { item: d.id, spells: [a.id, b.id] };
}
