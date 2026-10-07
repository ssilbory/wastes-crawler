import { parseLevelMap } from './dungeon-map.ts';
import { allMonsters } from './monsters.ts';
import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * Quests name real givers, towns, monsters, and earlier quests; their hexes are on passable land;
 * an escort is only ever a first step; and no quest needs itself, directly or not. A settlement has
 * at most one crypt, mortuary, or temple that raises the dead, and a village has none; only they
 * give raising quests.
 */
export function questReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const towns = new Set(content.regions.flatMap((r) => r.sites.map((s) => s.id)));
  const monsters = new Set(allMonsters(srd, content).map((m) => m.id));
  const givers = new Set(content.missionGivers.map((g) => g.id));
  const quests = new Map(content.quests.map((q) => [q.id, q]));
  const glyphs = new Map(content.terrains.map((t) => [t.glyph, t]));
  const passable = (regionId: string, h: { col: number; row: number }) => {
    const region = content.regions.find((r) => r.id === regionId);
    const glyph = region?.terrain[h.row]?.[h.col];
    const t = glyph === undefined ? undefined : glyphs.get(glyph);
    return t !== undefined && t.movement !== 'impassable';
  };
  const sites = new Map(content.regions.flatMap((r) => r.sites.map((s) => [s.id, s])));
  const raisers = new Set<string>();
  for (const g of content.missionGivers) {
    if (!towns.has(g.town)) errors.push(`missionGivers/${g.id}: unknown town ${g.town}`);
    if (!g.raises) continue;
    if (sites.get(g.town)?.size === 'village')
      errors.push(`missionGivers/${g.id}: a village has no ${g.raises}`);
    if (raisers.has(g.town))
      errors.push(`missionGivers/${g.id}: ${g.town} already raises the dead`);
    raisers.add(g.town);
  }
  const raising = new Set(content.missionGivers.filter((g) => g.raises).map((g) => g.id));
  for (const q of content.quests) {
    const where = `quests/${q.id}`;
    if (!givers.has(q.giver)) errors.push(`${where}: unknown giver ${q.giver}`);
    else if (q.reward.raise && !raising.has(q.giver))
      errors.push(`${where}: ${q.giver} can't raise the dead`);
    if (q.payer !== undefined) {
      if (!givers.has(q.payer)) errors.push(`${where}: unknown payer ${q.payer}`);
      if (q.payer === q.giver) errors.push(`${where}: the giver already pays`);
      if (q.reward.raise) errors.push(`${where}: a raising quest is paid by its giver`);
    }
    for (const p of q.prerequisites.quests)
      if (!quests.has(p)) errors.push(`${where}: unknown prerequisite ${p}`);
    q.objectives.forEach((o, i) => {
      if ((o.kind === 'slay' || o.kind === 'scout') && !passable(o.region, o.hex))
        errors.push(`${where}: step ${i + 1} is not on passable land`);
      if ((o.kind === 'deliver' || o.kind === 'escort') && !towns.has(o.to))
        errors.push(`${where}: step ${i + 1} goes to unknown town ${o.to}`);
      if (o.kind === 'escort' && i > 0) errors.push(`${where}: an escort must be the first step`);
      if (o.kind === 'reach' || o.kind === 'guardian' || o.kind === 'retrieve') {
        const level = content.dungeons
          .find((d) => d.id === o.dungeon)
          ?.levels.find((l) => l.id === o.level);
        const parsed = level && parseLevelMap(level.map);
        if (!parsed?.ok) errors.push(`${where}: step ${i + 1} is in no dungeon level`);
        else if (o.kind !== 'reach' && !parsed.map.inBounds(o.at))
          errors.push(`${where}: step ${i + 1} is off its level`);
      }
      const ids =
        o.kind === 'slay' || o.kind === 'guardian'
          ? o.enemies.flat()
          : o.kind === 'escort'
            ? [o.monster]
            : [];
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
