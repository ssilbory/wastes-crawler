import { gameSkills } from './skills.ts';
import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * Brewing uses a real skill; potions are items of their own, each with one recipe; recipes name
 * potions or other brewable gear (the antidote); and alchemists work in real settlements (one
 * each; crafter-check.ts counts the places) and stock only recipes within their Alchemy.
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
  if (taken.has(a.kit.id) || a.potions.some((p) => p.id === a.kit.id))
    errors.push(`alchemy/kit: ${a.kit.id} is taken`);
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
    if (towns.has(c.town)) errors.push(`${where}: ${c.town} already has an alchemist`);
    towns.add(c.town);
    for (const id of c.wares) {
      const r = a.recipes.find((x) => x.item === id);
      if (!r) errors.push(`${where}: no recipe ${id}`);
      // They stock only what they brew to order (alchemists.ts: 7 plus their Alchemy).
      else if (r.difficulty > 7 + c.alchemy) errors.push(`${where}: ${id} is past their Alchemy`);
    }
  }
  return errors;
}
