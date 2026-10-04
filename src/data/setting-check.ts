import { allMonsters } from './monsters.ts';
import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * Phase 12b's setting systems point at things that exist: standing orders at quests and hireling
 * types, authorities and garrisons and clues at orders, raids at a region with settlements, and
 * garrisons and raiders at known monsters and hexes on the map.
 */
export function settingReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const orders = new Set(content.standingOrders.map((o) => o.id));
  const monsters = new Set(allMonsters(srd, content).map((m) => m.id));
  const unknownMonsters = (where: string, rows: string[][]) => {
    for (const id of new Set(rows.flat()))
      if (!monsters.has(id)) errors.push(`${where}: unknown monster ${id}`);
  };
  for (const o of content.standingOrders) {
    if (o.complete && !content.quests.some((q) => q.id === o.complete))
      errors.push(`standingOrders/${o.id}: unknown quest ${o.complete}`);
    if (o.recruit && !content.npcRules.hirelings.some((h) => h.id === o.recruit))
      errors.push(`standingOrders/${o.id}: unknown hireling type ${o.recruit}`);
  }
  for (const a of content.authorities)
    for (const id of a.commands === 'all' ? [] : a.commands)
      if (!orders.has(id)) errors.push(`authorities/${a.id}: unknown order ${id}`);
  for (const r of content.regions)
    for (const g of r.garrisons) {
      const where = `regions/${r.id}: the garrison at ${g.col},${g.row}`;
      if (!orders.has(g.order)) errors.push(`${where} has unknown order ${g.order}`);
      if (r.terrain[g.row]?.[g.col] === undefined) errors.push(`${where} is off the map`);
      if (r.sites.some((s) => s.col === g.col && s.row === g.row))
        errors.push(`${where} is in a settlement`);
      unknownMonsters(where, g.enemies);
    }
  for (const t of content.encounterTables)
    for (const e of t.entries)
      if (e.order && !orders.has(e.order))
        errors.push(`encounterTables/${t.id}: unknown order ${e.order}`);
  for (const d of content.dungeons)
    for (const l of d.levels)
      for (const s of l.specials)
        if (s.kind === 'countersign' && !orders.has(s.order))
          errors.push(`dungeons/${d.id}/${l.id}: unknown order ${s.order}`);
  for (const q of content.quests) {
    for (const id of q.reward.countersigns ?? [])
      if (!orders.has(id)) errors.push(`quests/${q.id}: unknown order ${id}`);
    const token = q.reward.authority;
    if (token && !content.authorities.some((a) => a.id === token))
      errors.push(`quests/${q.id}: unknown authority ${token}`);
  }
  const raid = content.raidRules;
  const region = content.regions.find((r) => r.id === raid.region);
  if (!region) errors.push(`raidRules: unknown region ${raid.region}`);
  else if (region.sites.length === 0) errors.push(`raidRules: ${raid.region} has no settlements`);
  if (raid.warningDays >= content.overlandRules.daysPerMonth)
    errors.push('raidRules: the warning must come within the month');
  unknownMonsters('raidRules', raid.raiders);
  return errors;
}
