// Crafting components (docs/rules-adaptation.md, Crafting and modifying gear): the SRD's arcane
// salvage (2.8.2) as named, typed parts that drop from some monsters by chance. The party carries
// them in its shared stash with the loot dice, at half an item each (party-load.ts).
import { baseMonster } from '../../data/monsters.ts';
import type { ComponentType } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { note } from './members.ts';
import type { World } from './types.ts';

export const componentName = (data: GameData, id: string) =>
  data.content.components.find((c) => c.id === id)?.name ?? id;

/** Each beaten enemy that is a component's source, or drawn on one, drops one at its chance. */
export function componentDrops(w: World, data: GameData, enemies: readonly string[]): void {
  for (const monster of enemies)
    for (const c of data.content.components)
      for (const s of c.sources)
        if (s.monster === baseMonster(data.content, monster) && w.rng.int(1, 100) <= s.chance) {
          w.components[c.id] = (w.components[c.id] ?? 0) + 1;
          note(w, `The party takes ${c.name.toLowerCase()}.`);
        }
}

/** The component ids that would pay for these needs, in content order, or null if short. */
export function pickComponents(
  w: World,
  data: GameData,
  needs: readonly { type: ComponentType; count: number }[],
): string[] | null {
  const left = { ...w.components };
  const picked: string[] = [];
  for (const need of needs)
    for (let i = 0; i < need.count; i++) {
      const id = data.content.components.find(
        (c) => c.type === need.type && (left[c.id] ?? 0) > 0,
      )?.id;
      if (!id) return null;
      left[id] = (left[id] as number) - 1;
      picked.push(id);
    }
  return picked;
}

/** Component needs as words: `1 hide, 1 essence`, or `no components`. */
export const partsText = (needs: readonly { type: ComponentType; count: number }[]) =>
  needs.length === 0 ? 'no components' : needs.map((x) => `${x.count} ${x.type}`).join(', ');

export function addComponents(w: World, ids: readonly string[]): void {
  for (const id of ids) w.components[id] = (w.components[id] ?? 0) + 1;
}

export function removeComponents(w: World, ids: readonly string[]): void {
  for (const id of ids) {
    const n = (w.components[id] as number) - 1;
    w.components = n > 0 ? { ...w.components, [id]: n } : without(w.components, id);
  }
}

const without = (r: Record<string, number>, id: string) =>
  Object.fromEntries(Object.entries(r).filter(([k]) => k !== id));
