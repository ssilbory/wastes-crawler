import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import type { ContentData } from '../src/data/schemas/index.ts';
import { warlordReferenceErrors } from '../src/data/warlord-check.ts';
import { WORLD_MIGRATIONS } from '../src/game/world/save-migrations.ts';

const content = loadContent();
const lords = content.warlords;

describe('warlord content (Sam’s calls)', () => {
  it('loads a clean ladder of five, one a Wastes map', () => {
    expect(warlordReferenceErrors(content)).toEqual([]);
    expect(lords.warlords.map((l) => l.region)).toEqual(
      content.realms.find((r) => r.id === 'wastes')?.regions,
    );
    expect([lords.hostilePercent, lords.spoilsPercent]).toEqual([50, 20]);
  });

  it('reports unknown maps and tables, and a warlord with no hoard of their own', () => {
    const broken: ContentData = {
      ...content,
      warlords: {
        ...lords,
        warlords: [
          ...lords.warlords,
          { id: 'nobody', name: 'Nobody', region: 'atlantis', tables: ['nowhere'], fall: 'Gone.' },
        ],
      },
    };
    expect(warlordReferenceErrors(broken)).toEqual([
      'warlords/nobody: unknown region atlantis',
      'warlords/nobody: unknown table nowhere',
      'warlords/nobody: boss of 0 hoards, not 1',
    ]);
  });

  it('reports a hoard off its warlord’s map, an unguarded one, and unknown warlords', () => {
    const [first] = lords.warlords;
    if (!first) throw new Error('no warlords');
    const elsewhere = content.dungeons.find((d) => d.region !== first.region);
    if (!elsewhere) throw new Error('no dungeon');
    const level = elsewhere.levels[0] as (typeof elsewhere.levels)[0];
    const extra = (warlord: string, guarded: boolean) => ({
      kind: 'cache' as const,
      at: { x: 0, y: 0 },
      loot: [{ count: 1, sides: 6 }],
      ...(guarded ? { guards: [['dust-raider']] } : {}),
      warlord,
    });
    const dungeons = content.dungeons.map((d) =>
      d.id === elsewhere.id
        ? {
            ...d,
            levels: [
              {
                ...level,
                specials: [...level.specials, extra(first.id, false), extra('ghost', true)],
              },
              ...d.levels.slice(1),
            ],
          }
        : d,
    );
    expect(warlordReferenceErrors({ ...content, dungeons })).toEqual([
      `warlords/${first.id}: boss of 2 hoards, not 1`,
      `warlords/${first.id}: hoard in ${elsewhere.id}, off their map`,
      `warlords/${first.id}: hoard in ${elsewhere.id} has no guards`,
      `dungeons/${elsewhere.id}: unknown warlord ghost`,
    ]);
  });

  it('reports a warband riding off its warlord’s tables, or for no one', () => {
    const [first] = lords.warlords;
    const stray = {
      weight: 1,
      nature: 'hostile' as const,
      groups: [{ monster: 'gnoll', count: 1, row: 0 }],
    };
    const encounterTables = content.encounterTables.map((t) =>
      t.id === 'plains'
        ? {
            ...t,
            entries: [
              ...t.entries,
              { ...stray, warband: first?.id },
              { ...stray, warband: 'ghost' },
            ],
          }
        : t,
    );
    expect(warlordReferenceErrors({ ...content, encounterTables })).toEqual([
      `encounterTables/plains: ${first?.id}'s warband rides off their tables`,
      'encounterTables/plains: unknown warlord ghost',
    ]);
  });

  it('starts older saves with none fallen', () => {
    expect(WORLD_MIGRATIONS[38]?.({ schemaVersion: 38 })).toEqual({
      schemaVersion: 39,
      warlords: [],
    });
  });
});
