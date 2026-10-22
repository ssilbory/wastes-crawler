// The Vowed's arts that change the sheet (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/
// 1.5.17 The Vowed.md): Unarmed Might's punch from the class table, and Unarmored Defense's AC with
// no armor or shield. Vowed arts don't work in armor (Armored Magic aside), so the punch is a
// plain one when armored; Unarmored Defense needs no armor at all.
import type { Character, FocusEffect } from '../../data/schemas/index.ts';
import { characterLevel } from '../../rules/progression.ts';
import { punchRow, unarmoredAc } from '../../rules/vowed.ts';
import type { GameData } from './context.ts';
import { findItem } from './items.ts';
import { castingAllowed } from './magic.ts';

export const VOWED_TABLE = 'vowed-arts-and-unarmed-abilities';

export interface VowedShape {
  effects: FocusEffect[];
  innateAc: number | null;
}

type Held = Pick<Character, 'arts' | 'classes' | 'inventory' | 'foci'>;

/** What the character's Vowed arts add to the sheet. */
export function vowedShape(data: GameData, c: Held): VowedShape {
  const level = characterLevel(c.classes);
  const worn = c.inventory.filter((e) => e.location === 'worn').map((e) => findItem(data, e.id));
  const unarmored = !worn.some((i) => i?.kind === 'armor' || i?.kind === 'shield');
  const table = data.srd['casting-progressions'].find((t) => t.id === VOWED_TABLE);
  const punch = table?.levels[punchRow(level) - 1]?.punch;
  const might =
    c.arts.includes('unarmed-might') && punch && castingAllowed(data, c.inventory, c.foci);
  return {
    effects: might
      ? [
          {
            kind: 'vowed-punch',
            level: 1,
            hit: punch.hit,
            damage: punch.damage,
            shock: punch.shock,
          },
        ]
      : [],
    innateAc: c.arts.includes('unarmored-defense') && unarmored ? unarmoredAc(level) : null,
  };
}
