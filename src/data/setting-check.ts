import { parseLevelMap } from './dungeon-map.ts';
import { allMonsters } from './monsters.ts';
import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * Phase 12b and 12c's setting systems point at things that exist: standing orders at quests and
 * hireling types; authorities, garrisons (overland and underground), and clues at orders; messages
 * at peoples; raids at a region with settlements; and garrisons and raiders at known monsters and
 * at hexes or floor cells on the map.
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
  const peoples = new Set(content.peoples.map((p) => p.id));
  const sets = new Set(content.campaign.notes.sets.map((s) => s.id));
  for (const d of content.dungeons)
    for (const l of d.levels) {
      const where = `dungeons/${d.id}/${l.id}`;
      for (const s of l.specials) {
        if (s.kind === 'countersign' && !orders.has(s.order))
          errors.push(`${where}: unknown order ${s.order}`);
        if (s.kind === 'notes' && !sets.has(s.set)) errors.push(`${where}: unknown notes ${s.set}`);
        if (s.kind === 'token' && !content.authorities.some((a) => a.id === s.authority))
          errors.push(`${where}: unknown authority ${s.authority}`);
        if (s.kind === 'message')
          for (const p of s.people ?? [])
            if (!peoples.has(p)) errors.push(`${where}: message for unknown people ${p}`);
      }
      const parsed = parseLevelMap(l.map);
      for (const g of l.garrisons) {
        const post = `${where}: the garrison at ${g.at.x},${g.at.y}`;
        if (!orders.has(g.order)) errors.push(`${post} has unknown order ${g.order}`);
        if (parsed.ok && (!parsed.map.inBounds(g.at) || parsed.map.cell(g.at) !== 'floor'))
          errors.push(`${post} is not on a plain floor cell`);
        unknownMonsters(post, g.enemies);
      }
    }
  for (const q of content.quests) {
    for (const id of q.reward.countersigns ?? [])
      if (!orders.has(id)) errors.push(`quests/${q.id}: unknown order ${id}`);
    const token = q.reward.authority;
    if (token && !content.authorities.some((a) => a.id === token))
      errors.push(`quests/${q.id}: unknown authority ${token}`);
  }
  errors.push(...campaignErrors(content, monsters));
  const raid = content.raidRules;
  const region = content.regions.find((r) => r.id === raid.region);
  if (!region) errors.push(`raidRules: unknown region ${raid.region}`);
  else if (region.sites.length === 0) errors.push(`raidRules: ${raid.region} has no settlements`);
  if (raid.warningDays >= content.overlandRules.daysPerMonth)
    errors.push('raidRules: the warning must come within the month');
  unknownMonsters('raidRules', raid.raiders);
  return errors;
}

/** The endgame's quests, captives, givers, tokens, and monsters exist, and its patrols can come. */
function campaignErrors(content: ContentData, monsters: Set<string>): string[] {
  const errors: string[] = [];
  const { clock, notes, seal } = content.campaign;
  const quests = new Set(content.quests.map((q) => q.id));
  const givers = new Set(content.missionGivers.map((g) => g.id));
  for (const id of [...clock.knockback.quests, seal.quest])
    if (!quests.has(id)) errors.push(`campaign: unknown quest ${id}`);
  for (const id of clock.knockback.captives)
    if (!content.captives.some((c) => c.id === id)) errors.push(`campaign: unknown captive ${id}`);
  for (const id of [notes.giver, seal.giver])
    if (!givers.has(id)) errors.push(`campaign: unknown giver ${id}`);
  if (!content.authorities.some((a) => a.id === seal.authority))
    errors.push(`campaign: unknown authority ${seal.authority}`);
  for (const t of content.encounterTables)
    for (const e of t.entries)
      if ((e.minClock ?? 0) > clock.segments)
        errors.push(`encounterTables/${t.id}: a patrol needs more than ${clock.segments} segments`);
  for (const q of content.quests)
    for (const o of q.objectives)
      if (o.kind === 'guardian' && o.reinforce && !monsters.has(o.reinforce))
        errors.push(`quests/${q.id}: unknown monster ${o.reinforce}`);
  return errors;
}
