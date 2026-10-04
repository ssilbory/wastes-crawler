// Monster spellcasters: vendor/wwn-srd/5.0 Monsters and Foes/Monster and NPC Stats.md ("Mages
// generally have the spellcasting and Arts of an appropriate mage tradition at a level equal to
// their hit dice and Effort equal to their skill bonus plus two"). Slots come from the SRD casting
// table named in the monster's combat entry, as for a PC of that level (4.2.0).
import type { Monster, MonsterCaster } from '../../data/schemas/index.ts';
import { castingRow } from '../../rules/progression.ts';
import type { GameData } from '../character/context.ts';
import type { CasterState } from './types.ts';

export function monsterCaster(data: GameData, m: Monster, caster: MonsterCaster): CasterState {
  const table = data.srd['casting-progressions'].find((t) => t.id === caster.slots);
  if (!table) throw new Error(`unknown casting table ${caster.slots}`);
  return {
    level: m.hitDice,
    effortMax: m.skill + 2,
    effortUsed: 0,
    effortDay: 0,
    spellsLeft: castingRow(table, m.hitDice).spellsCast,
    prepared: [...caster.spells],
    known: [...caster.spells],
    arts: [...caster.arts],
    magicSkill: m.skill,
    castModifier: 0,
    canCast: true,
    usedThisScene: new Set(),
  };
}
