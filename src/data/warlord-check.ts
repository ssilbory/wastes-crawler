import type { ContentData } from './schemas/index.ts';

/**
 * Each warlord rules a known map through tables that exist, is the boss of exactly one guarded
 * hoard in a dungeon on that map, and has a warband only on their own tables.
 */
export function warlordReferenceErrors(content: ContentData): string[] {
  const errors: string[] = [];
  const tables = new Set(content.encounterTables.map((t) => t.id));
  const hoards = content.dungeons.flatMap((d) =>
    d.levels.flatMap((l) =>
      l.specials.flatMap((s) =>
        s.kind === 'cache' && s.warlord ? [{ warlord: s.warlord, d, guarded: !!s.guards }] : [],
      ),
    ),
  );
  for (const w of content.warlords.warlords) {
    const where = `warlords/${w.id}`;
    if (!content.regions.some((r) => r.id === w.region))
      errors.push(`${where}: unknown region ${w.region}`);
    for (const t of w.tables) if (!tables.has(t)) errors.push(`${where}: unknown table ${t}`);
    const theirs = hoards.filter((h) => h.warlord === w.id);
    if (theirs.length !== 1) errors.push(`${where}: boss of ${theirs.length} hoards, not 1`);
    for (const h of theirs) {
      if (h.d.region !== w.region) errors.push(`${where}: hoard in ${h.d.id}, off their map`);
      if (!h.guarded) errors.push(`${where}: hoard in ${h.d.id} has no guards`);
    }
  }
  const known = new Map(content.warlords.warlords.map((w) => [w.id, w]));
  for (const h of hoards)
    if (!known.has(h.warlord)) errors.push(`dungeons/${h.d.id}: unknown warlord ${h.warlord}`);
  for (const t of content.encounterTables)
    for (const e of t.entries) {
      if (!e.warband) continue;
      const w = known.get(e.warband);
      if (!w) errors.push(`encounterTables/${t.id}: unknown warlord ${e.warband}`);
      else if (!w.tables.includes(t.id))
        errors.push(`encounterTables/${t.id}: ${w.id}'s warband rides off their tables`);
    }
  return errors;
}
