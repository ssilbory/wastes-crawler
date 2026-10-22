// Rods (docs/rules-adaptation.md, Potions, scrolls, and magic devices: Devices; vendor/wwn-srd/
// 4.0 Magic and Spellcasting/4.9.0 Magic Items and Enchanted Treasures.md, 4.9.4: passive benefits
// are granted to the wielder automatically): a rod works while it is Readied.
import type { Character } from '../../data/schemas/index.ts';
import type { GameData } from './context.ts';
import { findItem } from './items.ts';

export type RodEffect = 'light' | 'mending' | 'warding';

/** Whether the character has a rod with this effect Readied. */
export function bearsRod(data: GameData, c: Character | null, effect: RodEffect): boolean {
  return (c?.inventory ?? []).some((e) => {
    if (e.location !== 'readied') return false;
    const item = findItem(data, e.id);
    return (
      item?.kind === 'device' &&
      item.device.device.kind === 'rod' &&
      item.device.device.effect === effect
    );
  });
}
