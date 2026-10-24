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
      realms: [],
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
      realms: [],
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

  it("keeps each realm a world of its own (Sam's call)", () => {
    const [realm] = content.realms;
    const [campaign] = content.regions;
    if (!realm || !campaign) throw new Error('missing content');
    const first = content.regions.find((r) => r.id === realm.start);
    if (!first) throw new Error('missing content');
    const broken = {
      ...content,
      realms: [
        { ...realm, regions: [...realm.regions, 'atlantis'], start: 'borderlands' },
        {
          ...realm,
          id: 'again',
          regions: [realm.start],
          ending: { region: realm.start, col: 999, row: 0, title: 'x', paragraphs: ['x'] },
        },
      ],
      regions: content.regions.map((r) =>
        r.id === campaign.id
          ? {
              ...r,
              exits: [
                {
                  ...first.exits[0],
                  name: 'in',
                  col: 23,
                  row: 8,
                  to: { region: first.id, col: 31, row: first.exits[0]?.row ?? 0 },
                },
              ],
            }
          : r,
      ),
    };
    expect(overlandReferenceErrors(srd, broken)).toEqual([
      'realms/wastes: unknown region atlantis',
      'realms/wastes: starts outside its regions, in borderlands',
      `realms/again: region ${realm.start} is already in wastes`,
      `realms/again: ends off its own maps, at ${realm.start} 999,0`,
      'regions/borderlands: the road at 23,8 leaves its realm',
      // Claimed by the second realm, the first map's roads east now leave it.
      `regions/${realm.start}: the road at 31,11 leaves its realm`,
      'regions/wastes-glass: the road at 0,11 leaves its realm',
    ]);
  });
});
