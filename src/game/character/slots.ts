// A casting class's tables (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/): its spell
// slots, the Invoker's spell points (1.5.11), and whether it ever gains arts.
import type { ClassOption } from '../../data/schemas/index.ts';
import { castingRow, type CastingLevelRow } from '../../rules/progression.ts';
import type { GameData } from './context.ts';

type Mage = NonNullable<ClassOption['mage']>;

export function castingTable(data: GameData, id: string) {
  const t = data.srd['casting-progressions'].find((c) => c.id === id);
  if (!t) throw new Error(`unknown casting table ${id}`);
  return t;
}

/** Whether the class ever gains arts, and so has Effort to spend; the Invoker doesn't (1.5.11). */
export const gainsArts = (data: GameData, mage: Mage): boolean =>
  mage.traditions.some((t) =>
    castingTable(data, t.arts).levels.some((l) => l.arts.length + l.anyArts > 0),
  );

/** Whether the class's spell points and preparations add the Int modifier: the Invoker (1.5.11). */
export const addsInt = (data: GameData, mage: Mage): boolean =>
  !!castingTable(data, mage.slots).plusInt;

/** `intModifier` counts only for the Invoker, whose points and preparations add it (1.5.11). */
export function spellSlots(
  data: GameData,
  mage: Mage,
  level = 1,
  intModifier = 0,
): CastingLevelRow {
  const row = castingRow(castingTable(data, mage.slots), level);
  if (!addsInt(data, mage)) return row;
  return {
    ...row,
    spellPoints: Math.max(0, row.spellPoints + intModifier),
    spellsPrepared: Math.max(0, row.spellsPrepared + intModifier),
  };
}
