// The Wastes' warlords (docs/rules-adaptation.md, The Wastes: Warlords, Warbands, and A warlord
// falls; Sam's calls). A warlord is the boss of a hoard in their stronghold; winning it is their
// fall, which strikes their warband from their map's tables, thins the hostile groups left there,
// and makes that map's villages pay more.
import type { Warlord } from '../../data/schemas/index.ts';
import { encounterWeights, type WeightedEntry } from '../../rules/warbands.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from './bus.ts';
import { note } from './members.ts';
import type { World } from './types.ts';

/** The warlord whose hoard a won fight's key names (`dungeon/level/x,y`), if any. */
export function warlordOfHoard(data: GameData, key: string): Warlord | undefined {
  const [dungeon, level, cell] = key.split('/');
  const [x, y] = (cell ?? '').split(',').map(Number);
  const special = data.content.dungeons
    .find((d) => d.id === dungeon)
    ?.levels.find((l) => l.id === level)
    ?.specials.find((s) => s.kind === 'cache' && s.at.x === x && s.at.y === y);
  const id = special?.kind === 'cache' ? special.warlord : undefined;
  return data.content.warlords.warlords.find((w) => w.id === id);
}

/** The roll weights of a table's entries, after the warlords fallen so far. */
export function warbandWeights(
  w: World,
  data: GameData,
  tableId: string,
  entries: readonly WeightedEntry[],
): number[] {
  const { warlords, hostilePercent } = data.content.warlords;
  const fallen = new Set(w.warlords);
  const thinned = warlords.some((l) => fallen.has(l.id) && l.tables.includes(tableId));
  return encounterWeights(entries, fallen, thinned, hostilePercent);
}

/** How many percent more the villages on the party's map pay, once its warlord has fallen. */
export function spoils(w: World, data: GameData): number {
  const { warlords, spoilsPercent } = data.content.warlords;
  return warlords.some((l) => l.region === w.region && w.warlords.includes(l.id))
    ? spoilsPercent
    : 0;
}

/** The warlords' bus listener: a won hoard whose boss is a warlord is that warlord's fall. */
export function warlordsListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind !== 'fight-won' || !e.garrison) return;
  const lord = warlordOfHoard(data, e.garrison);
  if (!lord || w.warlords.includes(lord.id)) return;
  w.warlords.push(lord.id);
  note(w, lord.fall);
}
