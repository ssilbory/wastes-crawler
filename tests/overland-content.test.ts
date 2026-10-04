import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { overlandReferenceErrors } from '../src/data/overland-check.ts';

const srd = loadSrd();
const content = loadContent();

describe('overland content', () => {
  it('loads a clean test region', () => {
    expect(overlandReferenceErrors(srd, content)).toEqual([]);
    const [region] = content.regions;
    expect(region?.terrain).toHaveLength(18);
    expect(region?.terrain[0]).toHaveLength(24);
    expect(content.overlandRules.months.filter((m) => m.season === 'winter')).toHaveLength(3);
  });

  it('checks roads between regions and regional encounter tables', () => {
    const [region] = content.regions;
    if (!region) throw new Error('missing content');
    const broken = {
      ...content,
      regions: [
        {
          ...region,
          exits: [
            {
              name: 'into the lake',
              col: 5,
              row: 4,
              to: { region: 'borderlands', col: 3, row: 8 },
            },
            { name: 'to nowhere', col: 3, row: 8, to: { region: 'atlantis', col: 0, row: 0 } },
          ],
          encounters: { lava: 'plains', plains: 'nothing' },
        },
      ],
    };
    expect(overlandReferenceErrors(srd, broken)).toEqual([
      'regions/borderlands: encounters for unknown terrain lava',
      'regions/borderlands: unknown table nothing',
      'regions/borderlands: the road at 5,4 is off the land',
      'regions/borderlands: the road at 3,8 leads nowhere',
    ]);
  });

  it('reports bad glyphs, grids, sites, tables, and monsters', () => {
    const [region] = content.regions;
    const [table] = content.encounterTables;
    const [plains] = content.terrains;
    if (!region || !table || !plains) throw new Error('missing content');
    const broken = {
      ...content,
      terrains: [...content.terrains, { ...plains, id: 'dupe', encounters: 'nowhere' }],
      regions: [
        {
          ...region,
          terrain: ['pq', 'p'],
          overlay: ['.?'],
          sites: [
            { id: 'a', name: 'A', kind: 'town' as const, size: 'town' as const, col: 9, row: 9 },
            { id: 'a', name: 'B', kind: 'town' as const, size: 'town' as const, col: 0, row: 1 },
          ],
          start: 'nowhere',
          exits: [],
        },
        {
          ...region,
          id: 'wet',
          terrain: ['r'],
          overlay: ['.'],
          sites: [
            { id: 'c', name: 'C', kind: 'town' as const, size: 'town' as const, col: 0, row: 0 },
          ],
          start: 'c',
          exits: [],
        },
      ],
      encounterTables: [
        ...content.encounterTables,
        {
          ...table,
          id: 'odd',
          entries: [
            {
              weight: 1,
              nature: 'hostile' as const,
              groups: [{ monster: 'dragon', count: 1, row: 0 }],
            },
          ],
        },
      ],
      mishaps: content.mishaps.filter((m) => m.table === 'travel'),
    };
    expect(overlandReferenceErrors(srd, broken)).toEqual([
      'terrains: duplicate glyph',
      'terrains/dupe: unknown table nowhere',
      'regions/borderlands: ragged terrain rows',
      "regions/borderlands: overlay doesn't match the terrain grid",
      'regions/borderlands: unknown terrain glyph q',
      'regions/borderlands: unknown overlay glyph ?',
      'regions/borderlands/a: off the map',
      'regions/borderlands: unknown start nowhere',
      'regions/borderlands: duplicate site id',
      'regions/wet/c: on impassable land',
      'encounterTables/odd: unknown monster dragon',
      'mishaps: no camp mishaps',
    ]);
  });
});
