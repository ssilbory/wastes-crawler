// The Beastmaster's arts that change the sheet (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class
// List/1.5.4 The Beastmaster.md): Natural Weaponry's fangs and claws, and Feral Toughness's AC.
import type { Character, FocusEffect, NaturalWeapon } from '../../data/schemas/index.ts';
import { feralAc, weaponryBonus } from '../../rules/beastmaster.ts';
import { characterLevel } from '../../rules/progression.ts';

export interface BeastShape {
  effects: FocusEffect[];
  innateAc: number | null;
}

/** What the character's Beastmaster arts add to the sheet. */
export function beastShape(c: Pick<Character, 'arts' | 'classes' | 'skills'>): BeastShape {
  const level = characterLevel(c.classes);
  const extra = weaponryBonus(level);
  // Punch or Stab, whichever the character fights with better.
  const skill = (c.skills.stab ?? -1) > (c.skills.punch ?? -1) ? 'stab' : 'punch';
  const weaponry: NaturalWeapon = {
    id: 'natural-weaponry',
    name: 'Natural Weaponry',
    damage: { count: 1, sides: 8, modifier: extra },
    shock: { damage: 2 + extra, maxAc: 13 },
    attributes: ['str', 'dex'],
    skill,
  };
  return {
    effects: c.arts.includes('natural-weaponry')
      ? [{ kind: 'natural-weapon', level: 1, weapon: weaponry }]
      : [],
    innateAc: c.arts.includes('feral-toughness') ? feralAc(level) : null,
  };
}
