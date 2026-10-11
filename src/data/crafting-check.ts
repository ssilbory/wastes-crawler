import { allMonsters } from './monsters.ts';
import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * Components drop from real monsters, every component type a mod or magic weapon needs exists, and
 * craftsmen work in towns (one each, never a village) and forge real weapons, the crafting tools
 * are an item of their own, and the armor that drops late is real body armor.
 */
export function craftingReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const monsters = new Set(allMonsters(srd, content).map((m) => m.id));
  for (const c of content.components)
    for (const s of c.sources)
      if (!monsters.has(s.monster)) errors.push(`components/${c.id}: unknown monster ${s.monster}`);
  const types = new Set(content.components.map((c) => c.type));
  for (const m of content.mods)
    for (const need of m.components)
      if (!types.has(need.type)) errors.push(`mods/${m.id}: no component is ${need.type}`);
  for (const t of content.craftingRules.magic.tiers)
    for (const need of t.components)
      if (!types.has(need.type)) errors.push(`craftingRules: no component is ${need.type}`);
  const tools = content.craftingRules.tools.id;
  if (
    [...srd.gear, ...srd['gear-bundles'], ...srd.weapons, ...srd.armor].some((x) => x.id === tools)
  )
    errors.push(`craftingRules: the tools' id ${tools} is an SRD item`);
  const body = new Set(srd.armor.filter((a) => a.category !== 'shield').map((a) => a.id));
  for (const id of content.craftingRules.drops.lateArmor)
    if (!body.has(id)) errors.push(`craftingRules: late armor ${id} isn't SRD body armor`);
  const sites = new Map(content.regions.flatMap((r) => r.sites.map((x) => [x.id, x])));
  const weapons = new Set(srd.weapons.map((x) => x.id));
  const towns = new Set<string>();
  for (const c of content.craftsmen) {
    const where = `craftsmen/${c.id}`;
    const site = sites.get(c.town);
    if (!site) errors.push(`${where}: unknown town ${c.town}`);
    else if (site.size === 'village') errors.push(`${where}: villages have no craftsman`);
    if (towns.has(c.town)) errors.push(`${where}: ${c.town} already has a craftsman`);
    towns.add(c.town);
    for (const id of c.weapons) if (!weapons.has(id)) errors.push(`${where}: unknown weapon ${id}`);
  }
  return errors;
}
