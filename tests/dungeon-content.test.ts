import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { dungeonReferenceErrors } from '../src/data/dungeon-check.ts';
import { parseLevelMap } from '../src/data/dungeon-map.ts';
import type { Dungeon } from '../src/data/schemas/index.ts';

const content = loadContent();
const tiny = ['+-+-+', '|<d |', '+ +-+', '|.s>|', '+-+-+'];

describe('the ASCII level format (docs/plan.md, Map format)', () => {
  it('reads cells and the edges between them', () => {
    const parsed = parseLevelMap(tiny);
    if (!parsed.ok) throw new Error(parsed.errors.join('; '));
    const map = parsed.map;
    expect([map.width, map.height]).toEqual([2, 2]);
    expect(map.cell({ x: 0, y: 0 })).toBe('up');
    expect(map.cell({ x: 1, y: 1 })).toBe('down');
    expect(map.cell({ x: 0, y: 1 })).toBe('floor');
    expect(map.edge({ x: 0, y: 0 }, 'e')).toBe('door');
    expect(map.edge({ x: 0, y: 0 }, 's')).toBe('open');
    expect(map.edge({ x: 1, y: 0 }, 's')).toBe('wall');
    expect(map.edge({ x: 0, y: 1 }, 'e')).toBe('secret');
    expect(map.edge({ x: 0, y: 0 }, 'n')).toBe('wall');
    expect(map.inBounds({ x: 2, y: 0 })).toBe(false);
    expect(() => map.cell({ x: 2, y: 0 })).toThrow('cell 2,0 is off the level');
    expect(() => map.edge({ x: -1, y: 0 }, 'n')).toThrow('cell -1,0 is off the level');
    const all = parseLevelMap(['+-+-+', '|T N|', '+-+-+']);
    expect(all.ok && [all.map.cell({ x: 0, y: 0 }), all.map.cell({ x: 1, y: 0 })]).toEqual([
      'trap',
      'npc',
    ]);
  });

  it('reports a misshapen grid and unknown or misplaced glyphs', () => {
    expect(parseLevelMap(['+-+', '| |'])).toEqual({
      ok: false,
      errors: ['the grid needs an odd number of rows and columns, at least 3 each'],
    });
    expect(parseLevelMap(['+-+', '| ', '+-+'])).toMatchObject({
      errors: ['row 1 is 2 wide, not 3'],
    });
    expect(parseLevelMap(['+-x', '|?q', '+ +'])).toEqual({
      ok: false,
      errors: [
        'row 0, column 2: corners are +',
        'row 1, column 1: unknown cell glyph ?',
        'row 1, column 2: the outer edge must be a wall',
        'row 2, column 1: the outer edge must be a wall',
      ],
    });
    expect(parseLevelMap(['+-+-+', '| x |', '+-+-+'])).toMatchObject({
      errors: ['row 1, column 2: unknown edge glyph x'],
    });
  });
});

describe('dungeon validation', () => {
  it('passes the test barrow', () => {
    expect(dungeonReferenceErrors(content)).toEqual([]);
  });

  const base = content.dungeons[0] as Dungeon;
  const check = (d: Dungeon) => dungeonReferenceErrors({ ...content, dungeons: [d] });
  const one = (
    map: string[],
    links: Dungeon['levels'][0]['links'],
    extra: Partial<Dungeon> = {},
  ): Dungeon => ({
    ...base,
    entry: { level: 'a', at: { x: 0, y: 0 }, facing: 'n' },
    levels: [
      {
        id: 'a',
        name: 'A',
        map,
        links,
        wander: null,
        safe: [],
        secrets: [],
        traps: [],
        specials: [],
        captives: [],
      },
    ],
    ...extra,
  });

  it('checks wandering tables and safe squares', () => {
    const level = {
      id: 'a',
      name: 'A',
      map: tiny,
      links: [],
      safe: [{ x: 5, y: 0 }],
      secrets: [],
      traps: [],
      specials: [],
      captives: [],
    };
    const d = { ...one(tiny, []), levels: [{ ...level, wander: { every: 2, table: 'crypt' } }] };
    expect(check(d)).toEqual(
      expect.arrayContaining([
        'dungeons/old-barrow/a: unknown encounter table crypt',
        'dungeons/old-barrow/a: safe square 5,0 is off the level',
      ]),
    );
  });

  it('checks traps, secret doors, and special squares against the map', () => {
    const level = base.levels[0] as Dungeon['levels'][0];
    const trap = level.traps[0] as Dungeon['levels'][0]['traps'][0];
    const d: Dungeon = {
      ...base,
      levels: [
        {
          ...level,
          traps: [{ ...trap, at: { x: 0, y: 0 } }],
          secrets: [{ at: { x: 0, y: 0 }, side: 'n', difficulty: 8 }],
          specials: [
            { kind: 'spinner', at: { x: 20, y: 0 } },
            {
              kind: 'teleporter',
              at: { x: 0, y: 0 },
              to: { level: 'nowhere', at: { x: 0, y: 0 }, facing: 'n' },
            },
          ],
        },
        ...base.levels.slice(1),
      ],
    };
    expect(check(d)).toEqual([
      'dungeons/old-barrow/barrow-upper: the trap at 4,6 has no details',
      'dungeons/old-barrow/barrow-upper: trap dart trap at 0,0 is not on a T',
      'dungeons/old-barrow/barrow-upper: secret at 0,0,n is not on a secret door',
      'dungeons/old-barrow/barrow-upper: spinner at 20,0 is off the level',
      "dungeons/old-barrow/barrow-upper: teleporter at 0,0 goes to a cell that isn't there",
    ]);
  });

  it('matches held captives with N cells', () => {
    const level = base.levels[0] as Dungeon['levels'][0];
    const held = level.captives[0] as Dungeon['levels'][0]['captives'][0];
    const d: Dungeon = {
      ...base,
      levels: [{ ...level, captives: [{ ...held, at: { x: 0, y: 0 } }] }, ...base.levels.slice(1)],
    };
    expect(check(d)).toEqual([
      'dungeons/old-barrow/barrow-upper: the NPC at 6,0 has no details',
      'dungeons/old-barrow/barrow-upper: captive at 0,0 is not on an N',
    ]);
  });

  it('reports bad maps', () => {
    expect(check(one(['+-+', '|?|', '+-+'], []))).toEqual([
      'dungeons/old-barrow/a: row 1, column 1: unknown cell glyph ?',
    ]);
  });

  it('matches stairs and links', () => {
    const surface = { at: { x: 1, y: 1 }, to: { surface: true as const } };
    expect(
      check(
        one(tiny, [
          surface,
          { at: { x: 0, y: 1 }, to: { level: 'a', at: { x: 9, y: 9 }, facing: 'n' as const } },
        ]),
      ),
    ).toEqual([
      'dungeons/old-barrow/a: stairs at 0,0 lead nowhere',
      'dungeons/old-barrow/a: link at 1,1 leads up to the surface from stairs down',
      'dungeons/old-barrow/a: link at 0,1 is not on stairs',
      "dungeons/old-barrow/a: link at 0,1 goes to a cell that isn't there",
    ]);
  });

  it('needs a real entry, reachable cells, and an entrance on open land outside towns', () => {
    const links = [
      { at: { x: 0, y: 0 }, to: { surface: true as const } },
      { at: { x: 1, y: 1 }, to: { level: 'a', at: { x: 0, y: 0 }, facing: 'n' as const } },
    ];
    expect(
      check(one(tiny, links, { entry: { level: 'b', at: { x: 0, y: 0 }, facing: 'n' } })),
    ).toEqual(["dungeons/old-barrow: the entry isn't on a level"]);
    const walled = ['+-+-+', '', '+-+-+'];
    walled[1] = '|<|T|';
    expect(check(one(walled, [links[0] as (typeof links)[0]]))).toEqual([
      'dungeons/old-barrow/a: the trap at 1,0 has no details',
      "dungeons/old-barrow/a: 1,0 can't be reached from the entry",
    ]);
    expect(check(one(tiny, links, { entrance: { col: 5, row: 5 } }))).toEqual([
      "dungeons/old-barrow: the entrance isn't on passable land",
    ]);
    expect(check(one(tiny, links, { entrance: { col: 3, row: 8 } }))).toEqual([
      'dungeons/old-barrow: the entrance is in a town',
    ]);
    expect(check(one(tiny, links, { region: 'atlantis' }))).toEqual([
      'dungeons/old-barrow: unknown region atlantis',
    ]);
  });
});
