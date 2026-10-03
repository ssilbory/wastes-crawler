import { describe, expect, it } from 'vitest';
import { parseLevelMap } from '../../../src/data/dungeon-map.ts';
import type { Dungeon } from '../../../src/data/schemas/index.ts';
import {
  blankMap,
  editorErrors,
  exportDungeons,
  setCell,
  setEdge,
  withLevelMap,
} from '../../../src/game/dungeon/level-edit.ts';
import {
  startWalk,
  walkMap,
  walkStairs,
  walkStep,
  walkTurn,
} from '../../../src/game/dungeon/sandbox.ts';
import { sandboxView } from '../../../src/render/dungeon-view.ts';
import { editorGrid } from '../../../src/render/level-editor-view.ts';
import { data } from '../world/helpers.ts';

const barrow = data.content.dungeons[0] as Dungeon;
const upper = barrow.levels[0]?.map as string[];

describe('the level editor model (docs/decisions/0003-level-authoring.md)', () => {
  it('makes a walled blank map that parses', () => {
    expect(blankMap(2, 1)).toEqual(['+-+-+', '| | |', '+-+-+']);
    const parsed = parseLevelMap(blankMap(5, 4));
    expect(parsed.ok && [parsed.map.width, parsed.map.height]).toEqual([5, 4]);
  });

  it('paints cells and edges, never the outer border', () => {
    let m = blankMap(2, 2);
    m = setCell(m, { x: 1, y: 0 }, 'down');
    m = setEdge(m, { x: 0, y: 0 }, 'e', 'door');
    m = setEdge(m, { x: 0, y: 0 }, 's', 'secret');
    m = setEdge(m, { x: 1, y: 1 }, 'n', 'open');
    expect(m).toEqual(['+-+-+', '| d>|', '+s+ +', '| | |', '+-+-+']);
    expect(setEdge(m, { x: 0, y: 0 }, 'e', 'wall')[1]).toBe('| |>|');
    expect(setEdge(m, { x: 0, y: 0 }, 's', 'wall')[2]).toBe('+-+ +');
    for (const side of ['n', 'w'] as const)
      expect(setEdge(m, { x: 0, y: 0 }, side, 'open')).toEqual(m);
    expect(setEdge(m, { x: 1, y: 1 }, 's', 'open')).toEqual(m);
    expect(setEdge(m, { x: 1, y: 1 }, 'e', 'open')).toEqual(m);
  });

  it('round-trips a hand-written level exactly', () => {
    const changed = setCell(upper, { x: 0, y: 0 }, 'trap');
    const back = setCell(changed, { x: 0, y: 0 }, 'floor');
    expect(back).toEqual(upper);
    const text = exportDungeons(data.content, withLevelMap(barrow, 'barrow-upper', back));
    expect(JSON.parse(text)).toEqual(data.content.dungeons);
    expect(text.endsWith(']\n')).toBe(true);
  });

  it('checks the edited dungeon with the level validator', () => {
    expect(editorErrors(data.content, barrow)).toEqual([]);
    // Walling in the entry room cuts off the rest of the level.
    let walled = upper;
    for (const x of [0, 1, 2]) walled = setEdge(walled, { x, y: 8 }, 'n', 'wall');
    walled = setEdge(walled, { x: 2, y: 8 }, 'e', 'wall');
    const errors = editorErrors(data.content, withLevelMap(barrow, 'barrow-upper', walled));
    expect(errors.some((e) => e.includes("can't be reached from the entry"))).toBe(true);
    expect(errors.every((e) => e.startsWith('dungeons/old-barrow'))).toBe(true);
    // Other dungeons are left as they are, and their problems aren't this one's.
    const twin = { ...barrow, id: 'twin-barrow', entrance: { col: 0, row: 0 } };
    const both = { ...data.content, dungeons: [...data.content.dungeons, twin] };
    expect(editorErrors(both, barrow)).toEqual([]);
    expect(JSON.parse(exportDungeons(both, barrow))[1].id).toBe('twin-barrow');
    const broken = withLevelMap(barrow, 'barrow-upper', ['+-+', '|x|', '+-+']);
    expect(editorErrors(data.content, broken)[0]).toContain('unknown cell glyph x');
  });
});

describe('the test walk', () => {
  it('starts at the entry, or where stairs arrive', () => {
    expect(startWalk(barrow, 'barrow-upper')).toEqual({
      level: barrow.entry.level,
      at: barrow.entry.at,
      facing: barrow.entry.facing,
    });
    expect(startWalk(barrow, 'barrow-lower').level).toBe('barrow-lower');
    const lone = {
      ...barrow,
      levels: [
        ...barrow.levels,
        { ...(barrow.levels[1] as Dungeon['levels'][0]), id: 'pit', links: [] },
      ],
    };
    expect(startWalk(lone, 'pit')).toEqual({ level: 'pit', at: { x: 0, y: 0 }, facing: 'n' });
  });

  it('walks the geometry, secret doors open, walls stop it', () => {
    const map = walkMap(barrow, 'barrow-upper');
    if (!map) throw new Error('the barrow parses');
    expect(walkMap(barrow, 'nowhere')).toBeNull();
    const start = startWalk(barrow, 'barrow-upper');
    expect(walkStep(map, start, 'forward')?.at).toEqual({ x: start.at.x, y: start.at.y - 1 });
    expect(walkStep(map, start, 'back')?.at).toEqual({ x: 1, y: 9 });
    const boxed = { level: 'barrow-upper', at: { x: 0, y: 3 }, facing: 'n' as const };
    expect(walkStep(map, boxed, 'forward')).toBeNull();
    const east = walkTurn(start, 'right');
    expect(east.facing).toBe('e');
    expect(walkTurn(east, 'left').facing).toBe('n');
    // The secret closet's door at 3,1 east.
    const closet = { level: 'barrow-upper', at: { x: 3, y: 1 }, facing: 'e' as const };
    expect(walkStep(map, closet, 'forward')?.at).toEqual({ x: 4, y: 1 });
    expect(walkStep(map, boxed, 'right')).toBeNull();
    expect(walkStep(map, boxed, 'left')).toBeNull();
    expect(walkStep(map, { ...closet, at: { x: 40, y: 40 } }, 'forward')).toBeNull();
  });

  it('takes stairs to linked levels only', () => {
    const down = barrow.levels[0]?.links.find((l) => 'level' in l.to);
    if (!down || !('level' in down.to)) throw new Error('the barrow has stairs down');
    const on = { level: 'barrow-upper', at: down.at, facing: 'n' as const };
    expect(walkStairs(barrow, on)).toEqual({
      level: down.to.level,
      at: down.to.at,
      facing: down.to.facing,
    });
    const out = barrow.levels[0]?.links.find((l) => 'surface' in l.to);
    expect(walkStairs(barrow, { ...on, at: out?.at ?? { x: 0, y: 0 } })).toBeNull();
    expect(walkStairs(barrow, { ...on, at: { x: 2, y: 2 } })).toBeNull();
    expect(walkStairs(barrow, { ...on, level: 'nowhere' })).toBeNull();
  });

  it('draws secret doors as doors and every trap', () => {
    const map = walkMap(barrow, 'barrow-upper');
    if (!map) throw new Error('the barrow parses');
    const view = sandboxView(map, { x: 3, y: 1 }, 'e');
    expect(view.find((p) => p.key === 'front-0-0')?.kind).toBe('door');
    expect(sandboxView(map, { x: 4, y: 8 }, 'n').some((p) => p.kind === 'trap')).toBe(true);
  });
});

describe('the editor grid', () => {
  it('lists every cell and every edge once, borders marked', () => {
    const grid = editorGrid(setEdge(blankMap(2, 1), { x: 0, y: 0 }, 'e', 'door'));
    expect(grid?.cells).toEqual([
      { x: 0, y: 0, kind: 'floor' },
      { x: 1, y: 0, kind: 'floor' },
    ]);
    expect(grid?.edges.map((e) => `${e.key}:${e.kind}${e.border ? '!' : ''}`)).toEqual([
      '0,0,n:wall!',
      '0,0,w:wall!',
      '0,0,s:wall!',
      '1,0,n:wall!',
      '1,0,w:door',
      '1,0,s:wall!',
      '1,0,e:wall!',
    ]);
    expect(grid).toMatchObject({ width: 56, height: 28 });
    expect(grid?.edges[0]).toMatchObject({ x1: 0, y1: 0, x2: 28, y2: 0 });
    expect(editorGrid(['+'])).toBeNull();
    expect(editorGrid(blankMap(2, 2))?.edges).toHaveLength(12);
  });
});
