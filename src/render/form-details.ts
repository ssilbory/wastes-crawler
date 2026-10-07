// What each of a Skinshifter's forms does (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/
// 1.5.15 The Skinshifter.md), for the character sheet and hover text. Pure.
import type { Attribute, Character } from '../data/schemas/index.ts';
import { ATTRIBUTES } from '../game/character/attributes.ts';
import type { GameData } from '../game/character/context.ts';
import { characterSheet } from '../game/character/derived.ts';
import { shiftCharacter } from '../game/character/shift.ts';
import { attackText, signed } from './attack-view.ts';
import { artHint } from './describe-view.ts';

const SHORT: Record<Attribute, string> = {
  str: 'Str',
  dex: 'Dex',
  con: 'Con',
  int: 'Int',
  wis: 'Wis',
  cha: 'Cha',
};

/** What arts do that the sheet's numbers don't show. */
const NOTES: Record<string, string> = {
  warform: '+2 to melee hits, and the form bonus to hit even in a humanoid shape',
  'eyes-of-the-hawk': '+2 to Notice checks',
  'serpents-kiss': 'A Savage Talons hit can spend Effort for the scene for 1d8 + Survive more',
};

export interface FormDetail {
  name: string;
  shape: 'humanoid' | 'non-humanoid';
  arts: { id: string; name: string; hint: string }[];
  /** What wearing the form changes from the character's own shape. */
  changes: string[];
}

export function formDetails(data: GameData, c: Character): FormDetail[] {
  const own = characterSheet(c, data);
  const ownAttacks = new Set(own.equipment.attacks.map((a) => `${a.id}:${a.mode}`));
  return (c.forms ?? []).map((f, i) => {
    const worn = characterSheet(c, data, i);
    const changes: string[] = [];
    const from = (label: string, a: number, b: number, sign = true) => {
      const show = (n: number) => (sign ? signed(n) : `${n}`);
      if (a !== b) changes.push(`${label} ${show(a)} → ${show(b)}`);
    };
    from('Attack bonus', own.attackBonus, worn.attackBonus);
    from('AC', own.equipment.armorClass, worn.equipment.armorClass, false);
    for (const a of ATTRIBUTES) from(SHORT[a], own.modifiers[a], worn.modifiers[a]);
    const hp = shiftCharacter(data, c, null, i).hp.max - c.hp.max;
    if (hp !== 0) changes.push(`Maximum HP ${signed(hp)}`);
    for (const a of worn.equipment.attacks)
      if (!ownAttacks.has(`${a.id}:${a.mode}`)) changes.push(attackText(a));
    for (const id of f.arts) if (NOTES[id]) changes.push(NOTES[id]);
    return {
      name: f.name,
      shape: f.humanoid ? 'humanoid' : 'non-humanoid',
      arts: f.arts.map((id) => ({
        id,
        name: data.srd.arts.find((x) => x.id === id)?.name ?? id,
        hint: artHint(data, id),
      })),
      changes,
    };
  });
}

/** Hover text for a form: its shape, then what it changes. */
export const formHint = (d: FormDetail): string =>
  [
    `${d.name}, ${d.shape}.`,
    ...(d.changes.length > 0 ? d.changes : ['No change to the sheet.']),
  ].join('\n');
