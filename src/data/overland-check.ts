import { allMonsters } from './monsters.ts';
import { DANGER_GLYPHS, type ContentData, type SrdData } from './schemas/index.ts';

/**
 * Regions use known glyphs in a clean grid, sites sit on passable land, tables exist, and roads
 * between regions start and end on passable land.
 */
export function overlandReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const byGlyph = new Map(content.terrains.map((t) => [t.glyph, t]));
  if (byGlyph.size !== content.terrains.length) errors.push('terrains: duplicate glyph');
  const tables = new Set(content.encounterTables.map((t) => t.id));
  for (const t of content.terrains) {
    if (!tables.has(t.encounters)) errors.push(`terrains/${t.id}: unknown table ${t.encounters}`);
  }
  for (const r of content.regions) {
    const where = `regions/${r.id}`;
    const width = r.terrain[0]?.length ?? 0;
    if (r.terrain.some((row) => row.length !== width)) errors.push(`${where}: ragged terrain rows`);
    if (r.overlay.length !== r.terrain.length || r.overlay.some((row) => row.length !== width))
      errors.push(`${where}: overlay doesn't match the terrain grid`);
    for (const g of new Set(r.terrain.join(''))) {
      if (!byGlyph.has(g)) errors.push(`${where}: unknown terrain glyph ${g}`);
    }
    for (const g of new Set(r.overlay.join(''))) {
      if (!(g in DANGER_GLYPHS)) errors.push(`${where}: unknown overlay glyph ${g}`);
    }
    for (const s of r.sites) {
      const glyph = r.terrain[s.row]?.[s.col];
      const terrain = glyph === undefined ? undefined : byGlyph.get(glyph);
      if (!terrain) errors.push(`${where}/${s.id}: off the map`);
      else if (terrain.movement === 'impassable')
        errors.push(`${where}/${s.id}: on impassable land`);
    }
    if (!r.sites.some((s) => s.id === r.start)) errors.push(`${where}: unknown start ${r.start}`);
    for (const [terrain, table] of Object.entries(r.encounters)) {
      if (!content.terrains.some((t) => t.id === terrain))
        errors.push(`${where}: encounters for unknown terrain ${terrain}`);
      if (!tables.has(table)) errors.push(`${where}: unknown table ${table}`);
    }
    for (const e of r.exits) {
      const passable = (regionId: string, col: number, row: number) => {
        const glyph = content.regions.find((x) => x.id === regionId)?.terrain[row]?.[col];
        const t = glyph === undefined ? undefined : byGlyph.get(glyph);
        return t !== undefined && t.movement !== 'impassable';
      };
      if (!passable(r.id, e.col, e.row))
        errors.push(`${where}: the road at ${e.col},${e.row} is off the land`);
      if (!passable(e.to.region, e.to.col, e.to.row))
        errors.push(`${where}: the road at ${e.col},${e.row} leads nowhere`);
    }
    const ids = r.sites.map((s) => s.id);
    if (new Set(ids).size !== ids.length) errors.push(`${where}: duplicate site id`);
  }
  const monsters = new Set(allMonsters(srd, content).map((m) => m.id));
  for (const t of content.encounterTables) {
    for (const e of t.entries) {
      for (const g of e.groups) {
        if (!monsters.has(g.monster))
          errors.push(`encounterTables/${t.id}: unknown monster ${g.monster}`);
      }
    }
  }
  for (const b of content.mapGen.biomes)
    if (!content.terrains.some((t) => t.id === b.terrain))
      errors.push(`mapGen: unknown terrain ${b.terrain}`);
  const passable = content.terrains.filter((t) => t.movement !== 'impassable').map((t) => t.id);
  if (!content.mapGen.biomes.some((b) => passable.includes(b.terrain)))
    errors.push('mapGen: no biome has land a settlement can stand on');
  if (!Object.values(content.mapGen.sizes).some((w) => w > 0))
    errors.push('mapGen: no settlement size has any odds');
  for (const table of ['travel', 'camp'] as const) {
    if (!content.mishaps.some((m) => m.table === table))
      errors.push(`mishaps: no ${table} mishaps`);
  }
  return errors;
}
