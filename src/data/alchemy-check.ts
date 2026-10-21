import { gameSkills } from './skills.ts';
import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * Brewing uses a real skill; potions are items of their own, each with one recipe; recipes name
 * potions or other brewable gear (the antidote); and alchemists work in towns (one each, never a
 * village) and keep only recipes in stock.
 */
export function alchemyReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const a = content.alchemy;
  const errors: string[] = [];
  if (!gameSkills(srd, content).some((s) => s.id === a.skill))
    errors.push(`alchemy: unknown skill ${a.skill}`);
  const taken = new Set([
    ...srd.gear.map((g) => g.id),
    ...srd.weapons.map((g) => g.id),
    ...srd.armor.map((g) => g.id),
    ...content.shields.map((s) => s.id),
    content.ailments.antidote.id,
    content.craftingRules.tools.id,
  ]);
  for (const p of a.potions) if (taken.has(p.id)) errors.push(`alchemy/potions/${p.id}: id taken`);
  const brewable = new Set([...a.potions.map((p) => p.id), content.ailments.antidote.id]);
  const recipes = a.recipes.map((r) => r.item);
  for (const r of a.recipes)
    if (!brewable.has(r.item)) errors.push(`alchemy/recipes: unknown item ${r.item}`);
  for (const id of new Set(recipes.filter((x, i) => recipes.indexOf(x) !== i)))
    errors.push(`alchemy/recipes: ${id} twice`);
  for (const p of a.potions)
    if (!recipes.includes(p.id)) errors.push(`alchemy/potions/${p.id}: no recipe`);
  if (!a.batches.some((b) => b.doses === 1)) errors.push('alchemy: no single-dose batch');
  const sites = new Map(content.regions.flatMap((r) => r.sites.map((x) => [x.id, x])));
  const towns = new Set<string>();
  for (const c of a.alchemists) {
    const where = `alchemy/alchemists/${c.id}`;
    const site = sites.get(c.town);
    if (!site) errors.push(`${where}: unknown town ${c.town}`);
    else if (site.size === 'village') errors.push(`${where}: villages have no alchemist`);
    if (towns.has(c.town)) errors.push(`${where}: ${c.town} already has an alchemist`);
    towns.add(c.town);
    for (const id of c.wares) if (!recipes.includes(id)) errors.push(`${where}: no recipe ${id}`);
  }
  return errors;
}
