import { allMonsters } from './monsters.ts';
import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * Quests name real givers, towns, monsters, and earlier quests; their hexes are on passable land;
 * an escort is only ever a first step; and no quest needs itself, directly or not.
 */
export function questReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const towns = new Set(content.regions.flatMap((r) => r.sites.map((s) => s.id)));
  const monsters = new Set(allMonsters(srd, content).map((m) => m.id));
  const givers = new Set(content.missionGivers.map((g) => g.id));
  const quests = new Map(content.quests.map((q) => [q.id, q]));
  const region = content.regions[0];
  const glyphs = new Map(content.terrains.map((t) => [t.glyph, t]));
  const passable = (h: { col: number; row: number }) => {
    const glyph = region?.terrain[h.row]?.[h.col];
    const t = glyph === undefined ? undefined : glyphs.get(glyph);
    return t !== undefined && t.movement !== 'impassable';
  };
  for (const g of content.missionGivers) {
    if (!towns.has(g.town)) errors.push(`missionGivers/${g.id}: unknown town ${g.town}`);
  }
  for (const q of content.quests) {
    const where = `quests/${q.id}`;
    if (!givers.has(q.giver)) errors.push(`${where}: unknown giver ${q.giver}`);
    for (const p of q.prerequisites.quests)
      if (!quests.has(p)) errors.push(`${where}: unknown prerequisite ${p}`);
    q.objectives.forEach((o, i) => {
      if ((o.kind === 'slay' || o.kind === 'scout') && !passable(o.hex))
        errors.push(`${where}: step ${i + 1} is not on passable land`);
      if ((o.kind === 'deliver' || o.kind === 'escort') && !towns.has(o.to))
        errors.push(`${where}: step ${i + 1} goes to unknown town ${o.to}`);
      if (o.kind === 'escort' && i > 0) errors.push(`${where}: an escort must be the first step`);
      const ids = o.kind === 'slay' ? o.enemies.flat() : o.kind === 'escort' ? [o.monster] : [];
      for (const id of ids) if (!monsters.has(id)) errors.push(`${where}: unknown monster ${id}`);
    });
    const seen = new Set<string>();
    const walk = (id: string): boolean => {
      if (id === q.id && seen.size > 0) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return (quests.get(id)?.prerequisites.quests ?? []).some(walk);
    };
    if (walk(q.id)) errors.push(`${where}: needs itself`);
  }
  return errors;
}
