import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * The scroll and the devices are items of their own: their ids are free of every other item's,
 * and a staff can hold as many spells as it asks for.
 */
export function deviceReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const taken = new Set([
    ...srd.gear.map((g) => g.id),
    ...srd.weapons.map((g) => g.id),
    ...srd.armor.map((g) => g.id),
    ...srd['gear-bundles'].map((g) => g.id),
    ...content.shields.map((s) => s.id),
    ...content.alchemy.potions.map((p) => p.id),
    content.ailments.antidote.id,
    content.craftingRules.tools.id,
  ]);
  const own = [content.scrolls.scroll, ...content.devices.devices];
  for (const item of own) if (taken.has(item.id)) errors.push(`devices: ${item.id} is taken`);
  for (const d of content.devices.devices)
    if (d.device.kind === 'staff' && d.device.minSpells > d.device.maxSpells)
      errors.push(`devices/${d.id}: fewer spells at most than at least`);
  return errors;
}
