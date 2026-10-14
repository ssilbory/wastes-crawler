import { describe, expect, it } from 'vitest';
import { loadSrd } from '../../../src/data/load.ts';
import { npcReferenceErrors } from '../../../src/data/npc-check.ts';
import { enterRegion } from '../../../src/game/world/crossing.ts';
import { rollEnemies } from '../../../src/game/world/encounters.ts';
import { regionMap } from '../../../src/game/world/region.ts';
import { data, world } from './helpers.ts';

const homeOf = (id: string | null) => data.content.captives.find((c) => c.id === id)?.destination;

function captives(region: string, table: string): (string | null)[] {
  const w = world();
  if (region !== w.region) enterRegion(w, region, { col: 2, row: 2 });
  return Array.from({ length: 300 }, () => rollEnemies(w, data, table).captive);
}

describe('captives bound within the region (docs/rules-adaptation.md, Rescues)', () => {
  it('holds captives bound for the Borderlands on its own plains', () => {
    const held = captives('borderlands', 'plains').filter((c) => c !== null);
    expect(held).toContain('merchant');
  });

  it("holds none on a shared table in another region, whose captives aren't bound there", () => {
    expect(captives('dark-lands', 'plains').every((c) => c === null)).toBe(true);
    expect(captives('pale-reach', 'plains').every((c) => c === null)).toBe(true);
  });

  it("holds the Dark Lands' own captives, bound for its towns", () => {
    const towns = regionMap(data, 'dark-lands').sites.map((s) => s.id);
    for (const table of ['dl-plains', 'dl-forest', 'dl-hills', 'dl-badlands']) {
      const held = captives('dark-lands', table).filter((c) => c !== null);
      expect(held.length).toBeGreaterThan(0);
      for (const c of held) expect(towns).toContain(homeOf(c));
    }
  });

  it("reports a region's table holding a captive bound elsewhere", () => {
    const broken = {
      ...data.content,
      encounterTables: data.content.encounterTables.map((t) =>
        t.id === 'dl-hills'
          ? { ...t, entries: t.entries.map((e) => (e.captive ? { ...e, captive: 'scholar' } : e)) }
          : t,
      ),
    };
    expect(npcReferenceErrors(loadSrd(), broken)).toEqual([
      'encounterTables/dl-hills: captive scholar is bound outside dark-lands',
    ]);
  });
});
