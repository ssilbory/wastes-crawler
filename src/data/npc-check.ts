import { allMonsters } from './monsters.ts';
import type { ContentData, SrdData } from './schemas/index.ts';

/** Hirelings and captives use real monsters, captives head for real towns, tables name real captives. */
export function npcReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const monsters = new Set(allMonsters(srd, content).map((m) => m.id));
  const towns = new Set(content.regions.flatMap((r) => r.sites.map((s) => s.id)));
  const captives = new Set(content.captives.map((c) => c.id));
  for (const h of content.npcRules.hirelings) {
    if (!monsters.has(h.monster)) errors.push(`npcRules/${h.id}: unknown monster ${h.monster}`);
  }
  const tiers = new Set(content.townRules.xp.tiers.map((t) => t.name));
  for (const t of content.npcRules.moraleTiers) {
    if (!tiers.has(t)) errors.push(`npcRules: unknown XP tier ${t}`);
  }
  for (const c of content.captives) {
    if (!monsters.has(c.monster)) errors.push(`captives/${c.id}: unknown monster ${c.monster}`);
    if (!towns.has(c.destination)) errors.push(`captives/${c.id}: unknown town ${c.destination}`);
  }
  for (const t of content.encounterTables) {
    for (const e of t.entries) {
      if (e.captive !== undefined && !captives.has(e.captive))
        errors.push(`encounterTables/${t.id}: unknown captive ${e.captive}`);
    }
  }
  return errors;
}
