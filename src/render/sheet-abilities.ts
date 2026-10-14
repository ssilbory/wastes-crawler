// Arts that change a character's AC or attacks beyond their own sheet, for the character screen:
// Cold Flesh (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.14 The Necromancer.md),
// Armor of God (1.5.5 The Blood Priest.md), Pavis of Elements (1.5.7 The Elementalist.md), and a
// Skinshifter's forms with Savage Talons and Intrinsic Armor (1.5.15 The Skinshifter.md). The numbers
// match the fight's (src/game/combat/damage.ts, effectiveAc). Pure.
import type { Character } from '../data/schemas/index.ts';
import { classOption } from '../game/character/class-step.ts';
import type { GameData } from '../game/character/context.ts';
import { characterSheet, type Sheet } from '../game/character/derived.ts';
import { armorFreeArts } from '../game/character/magic.ts';
import { armorClass } from '../rules/armor-class.ts';
import { characterLevel } from '../rules/progression.ts';
import { attackText } from './attack-view.ts';

/** Pavis of Elements never raises AC above this (1.5.7). */
const PAVIS_CAP = 18;

export interface SheetAbilities {
  /** "Armor of God, while its Effort stays committed: AC 16". */
  armor: string[];
  /** "Wolf form: Savage Talons (melee) +2, 1d8+3, Shock 5/AC 13". */
  attacks: string[];
}

/** AC with a natural AC of `floor` if that is better, as shields and Dex still apply to it. */
function naturalAc(sheet: Sheet, floor: number): number {
  const { armorClass: ac, armorClassInput: input } = sheet.equipment;
  if (floor === 0) return ac;
  return Math.max(ac, armorClass({ ...input, innateAc: Math.max(input.innateAc ?? 0, floor) }));
}

/** The level of the class that casts, as the fight counts it. */
const casterLevel = (data: GameData, c: Character): number =>
  Object.entries(c.classes.levels).find(
    ([cls, l]) => l >= 1 && classOption(data, cls)?.mage,
  )?.[1] ?? 0;

const nameOf = (data: GameData, id: string) => data.srd.arts.find((a) => a.id === id)?.name ?? id;

export function sheetAbilities(data: GameData, c: Character): SheetAbilities {
  const own = characterSheet(c, data);
  const level = characterLevel(c.classes);
  const coldFloor = c.arts.includes('cold-flesh') ? 12 + Math.floor(level / 2) : 0;
  const base = naturalAc(own, coldFloor);
  const armor: string[] = [];
  if (base !== own.equipment.armorClass) armor.push(`${nameOf(data, 'cold-flesh')}: AC ${base}`);

  const usable = (id: string) =>
    own.magic?.canCast === true || armorFreeArts(data, c.classes, [id]).length > 0;
  const committed = (id: string, ac: number) => {
    if (!c.arts.includes(id) || ac <= base) return;
    const blocked = usable(id) ? '' : ' (armor blocks it)';
    armor.push(`${nameOf(data, id)}, while its Effort stays committed: AC ${ac}${blocked}`);
  };
  for (const m of data.content.combatMagic) {
    if (m.source !== 'art' || m.target !== 'self') continue;
    if (m.effect.kind === 'ac-floor')
      committed(m.id, naturalAc(own, m.effect.base + Math.floor(casterLevel(data, c) / 2)));
    if (m.effect.kind === 'ac-bonus')
      committed(m.id, Math.max(base, Math.min(base + m.effect.amount, PAVIS_CAP)));
  }

  const ownAttacks = new Set(own.equipment.attacks.map((a) => `${a.id}:${a.mode}`));
  const attacks: string[] = [];
  (c.forms ?? []).forEach((f, i) => {
    const worn = characterSheet(c, data, i);
    const ac = naturalAc(worn, coldFloor);
    if (ac !== base) armor.push(`${f.name} form: AC ${ac}`);
    for (const a of worn.equipment.attacks)
      if (!ownAttacks.has(`${a.id}:${a.mode}`)) attacks.push(`${f.name} form: ${attackText(a)}`);
  });
  return { armor, attacks };
}
