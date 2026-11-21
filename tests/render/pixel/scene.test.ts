import { describe, expect, it } from 'vitest';
import type { DungeonState } from '../../../src/data/schemas/index.ts';
import type { World } from '../../../src/game/world/types.ts';
import { dungeonView, type Panel } from '../../../src/render/dungeon-view.ts';
import { walkLight, type LightView } from '../../../src/render/dungeon-light.ts';
import { encounterPortrait } from '../../../src/render/encounter-portrait.ts';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../../src/render/dungeon-geometry.ts';
import { BEYOND, depthAt, drawSurface, newFrame } from '../../../src/render/pixel/frame.ts';
import { emptyMask } from '../../../src/render/pixel/mask.ts';
import { MAT } from '../../../src/render/pixel/palette.ts';
import { renderScene } from '../../../src/render/pixel/scene.ts';
import { brightness, flickers, glowAt, lightFrame } from '../../../src/render/pixel/shade.ts';
import { trapSprite, type Rasterize } from '../../../src/render/pixel/sprites.ts';
import { lampsOf } from '../../../src/render/dungeon-lamps.ts';
import { data, world } from '../../game/world/helpers.ts';

function at(dungeon: string, level: string, x: number, y: number, facing: DungeonState['facing']) {
  const w = world();
  w.dungeon = {
    dungeon,
    level,
    at: { x, y },
    facing,
    seen: {},
    turn: 0,
    steps: 0,
    found: {},
    dug: {},
    glimpsed: {},
    traps: {},
    read: {},
    sight: null,
    sensed: {},
    located: {},
  };
  w.light.lit = 'torch';
  w.light.torch = 6;
  return w;
}

/**
 * Stands in for the browser's path filling: a shape covers the middle of its box, a fill more of
 * it than a stroke, and an empty box nothing.
 */
const raster: Rasterize = (s) => {
  const m = emptyMask(s.box.x, s.box.y, s.box.w, s.box.h);
  const inset = s.stroke === null ? 0.25 : 0.4;
  for (let y = Math.floor(m.h * inset); y < Math.ceil(m.h * (1 - inset)); y++)
    for (let x = Math.floor(m.w * inset); x < Math.ceil(m.w * (1 - inset)); x++)
      m.on[y * m.w + x] = 1;
  return m;
};

const count = (w: World, mat: number) => {
  const f = renderScene(dungeonView(w, data), [], raster);
  return f.mat.filter((m) => m === mat).length;
};

describe('pixel scene (docs/presentation-plan.md, V8)', () => {
  it('lays walls, floors, and ceilings far to near, each pixel with its distance', () => {
    const w = at('old-barrow', 'barrow-upper', 1, 3, 'n');
    const f = renderScene(dungeonView(w, data), [], raster);
    expect(f.width).toBe(VIEW_WIDTH);
    expect(f.height).toBe(VIEW_HEIGHT);
    const mid = (VIEW_HEIGHT / 2) * VIEW_WIDTH + VIEW_WIDTH / 2;
    // A door straight ahead, one plane away.
    expect(f.mat[mid]).toBe(MAT.wood);
    expect(f.depth[mid]).toBe(1);
    // The floor at the party's feet is nearer than the floor further on.
    const foot = (VIEW_HEIGHT - 1) * VIEW_WIDTH + VIEW_WIDTH / 2;
    const further = (VIEW_HEIGHT / 2 + 30) * VIEW_WIDTH + VIEW_WIDTH / 2;
    expect(f.depth[foot]).toBeLessThan(f.depth[further] as number);
    expect([...f.depth].some((d) => d === BEYOND)).toBe(false);
  });

  it('shows what stands ahead as outlined sprites, and a pending encounter in front', () => {
    // The captive among their guards, by the altar between braziers.
    const w = at('old-barrow', 'barrow-upper', 9, 0, 'w');
    const panels = dungeonView(w, data);
    expect(panels.some((p) => p.occupant)).toBe(true);
    expect(panels.some((p) => p.furniture)).toBe(true);
    const f = renderScene(panels, [], raster);
    for (const m of [MAT.foe, MAT.cloth, MAT.flame, MAT.void]) expect(f.mat).toContain(m);
    const foes = encounterPortrait(data, [['thug-or-militia', 'thug-or-militia']]);
    const g = renderScene(panels, foes, raster);
    expect(g.mat.filter((m) => m === MAT.foe).length).toBeGreaterThan(
      f.mat.filter((m) => m === MAT.foe).length,
    );
  });

  it('lays stairs down and a known trap’s plate and chalk into the scene', () => {
    const stairs = at('old-barrow', 'barrow-upper', 9, 2, 'n');
    expect(dungeonView(stairs, data).some((p) => p.kind === 'down')).toBe(true);
    expect(count(stairs, MAT.stone)).toBeGreaterThan(0);
    const up = at('old-barrow', 'barrow-upper', 1, 6, 's');
    expect(dungeonView(up, data).some((p) => p.kind === 'up')).toBe(true);
    expect(count(up, MAT.stone)).toBeGreaterThan(0);
    const trapped = at('old-barrow', 'barrow-upper', 4, 8, 'n');
    (trapped.dungeon as DungeonState).traps = { 'barrow-upper': { '4,6': 'noticed' } };
    expect(count(trapped, MAT.chalk)).toBeGreaterThan(0);
  });

  it('shows a hoard’s chest among its guards', () => {
    const w = at('scrap-kings-pumpworks', 'scrap-kings-pumpworks-2', 6, 2, 'n');
    expect(count(w, MAT.wood)).toBeGreaterThan(0);
    expect(count(w, MAT.glint)).toBeGreaterThan(0);
  });

  it('opens a dug wall onto what lies behind it, and keeps magical darkness black', () => {
    const plain = at('old-barrow', 'barrow-upper', 5, 8, 'e');
    const dug = at('old-barrow', 'barrow-upper', 5, 8, 'e');
    (dug.dungeon as DungeonState).dug = { 'barrow-upper': ['8,8,w'] };
    const front = (w: World) => dungeonView(w, data).find((p) => p.key === 'front-2-0');
    expect(front(dug)?.kind).toBe('dug');
    const f = newFrame();
    drawSurface(f, front(dug) as Panel);
    const g = newFrame();
    drawSurface(g, front(plain) as Panel);
    expect(f.depth.filter((d) => d === BEYOND).length).toBeGreaterThan(
      g.depth.filter((d) => d === BEYOND).length,
    );
    const dark = at('old-barrow', 'barrow-lower', 6, 1, 's');
    expect(count(dark, MAT.darkness)).toBeGreaterThan(0);
  });

  it('draws a known trap’s plate and marks, and only marks for a tripwire', () => {
    const plate = dungeonView(at('old-barrow', 'barrow-upper', 1, 3, 'n'), data).find(
      (p) => p.key === 'floor-0-0',
    ) as Panel;
    const trap: Panel = {
      ...plate,
      kind: 'trap',
      span: { ...plate.span, far: plate.span.near },
      trap: {
        plate: true,
        chalk: 'M0,0',
        holes: 'M1,1',
        stain: 'M2,2',
        stainKind: 'poison',
        wire: '',
        wedge: 'M3,3',
      },
    };
    const f = newFrame();
    drawSurface(f, trap);
    expect(f.mat).toContain(MAT.iron);
    const s = trapSprite(trap, f);
    expect(s.layers.map((l) => l.mat)).toEqual([MAT.poison, MAT.void, MAT.wood, MAT.chalk]);
    const wire: Panel = {
      ...trap,
      trap: {
        ...(trap.trap as NonNullable<Panel['trap']>),
        plate: false,
        stainKind: 'disease',
        wire: 'M0,0',
      },
    };
    const g = newFrame();
    drawSurface(g, wire);
    expect(g.mat).not.toContain(MAT.iron);
    expect(trapSprite(wire, g).layers.map((l) => l.mat)).toContain(MAT.filth);
    expect(trapSprite(wire, g).layers.map((l) => l.mat)).toContain(MAT.iron);
  });

  it('leaves out panels it has no texture or face for', () => {
    const p = dungeonView(at('old-barrow', 'barrow-upper', 1, 3, 'n'), data)[0] as Panel;
    const f = newFrame();
    drawSurface(f, { ...p, quad: null });
    drawSurface(f, { ...p, kind: 'occupant' });
    drawSurface(f, {
      ...p,
      quad: [
        [0, 0],
        [10, 0],
        [20, 0],
        [5, 0],
      ],
    });
    expect(f.mat.every((m) => m === MAT.void)).toBe(true);
  });

  it('reads distance along a panel by which way it runs', () => {
    const p = dungeonView(at('old-barrow', 'barrow-upper', 1, 3, 'n'), data)[0] as Panel;
    const span = {
      near: 1,
      far: 2,
      from: [0, 0] as [number, number],
      to: [0, 0] as [number, number],
    };
    expect(depthAt({ ...p, kind: 'floor', span }, 0.3, 1)).toBe(1);
    expect(depthAt({ ...p, kind: 'ceiling', span }, 0.3, 0)).toBe(2);
    expect(depthAt({ ...p, kind: 'wall', span }, 0.5, 0.9)).toBe(1.5);
    expect(depthAt({ ...p, kind: 'wall', span: { ...span, far: 1 } }, 0.5, 0.9)).toBe(1);
  });
});

describe('pixel lighting', () => {
  const torch = walkLight();
  const sight: LightView = { ...torch, source: 'sight', tint: '#7f93b0', flicker: false, pool: 0 };

  it('dims with distance, pools at the feet, and leaves fire as bright as it is', () => {
    const near = brightness(torch, MAT.stone, 0.6, 0, 0, 1);
    const far = brightness(torch, MAT.stone, 0.6, 4, 0, 1);
    expect(near).toBeGreaterThan(far);
    // Past the light's reach a surface is a shape, not nothing.
    expect(far).toBeGreaterThan(0);
    expect(brightness(torch, MAT.flame, 0.9, 4, 0, 1)).toBe(0.9);
    expect(brightness(torch, MAT.stone, 0.6, 1, 1, 1)).toBeGreaterThan(
      brightness(torch, MAT.stone, 0.6, 1, 0, 1),
    );
    expect(brightness(torch, MAT.stone, 0.6, 1, 0, 0.8)).toBeLessThan(
      brightness(torch, MAT.stone, 0.6, 1, 0, 1),
    );
    expect(brightness(sight, MAT.stone, 0.6, 0, 0, 1)).toBeLessThan(near);
  });

  it('glows low in the middle of the view', () => {
    expect(glowAt(160, 240, 320, 240)).toBeGreaterThan(0.9);
    expect(glowAt(0, 0, 320, 240)).toBe(0);
  });

  it('lights a frame into opaque RGBA from the ramps, a torch in three frames', () => {
    const f = renderScene(
      dungeonView(at('old-barrow', 'barrow-upper', 1, 3, 'n'), data),
      [],
      raster,
    );
    const rgba = lightFrame(f, torch);
    expect(rgba).toHaveLength(VIEW_WIDTH * VIEW_HEIGHT * 4);
    expect(rgba[3]).toBe(255);
    const dim = lightFrame(f, torch, 0.82);
    const sum = (a: Uint8ClampedArray) => a.reduce((s, v) => s + v, 0);
    expect(sum(dim)).toBeLessThan(sum(rgba));
    // Built once per colour, and the same frame twice is the same picture.
    expect(lightFrame(f, torch)).toEqual(rgba);
    expect(lightFrame(newFrame(), sight).every((v, i) => i % 4 === 3 || v < 40)).toBe(true);
    // Braziers and candles brighten the frame about them (dungeon-lamps.ts).
    const shrine = dungeonView(at('old-barrow', 'barrow-upper', 9, 0, 'w'), data);
    const g = renderScene(shrine, [], raster);
    expect(sum(lightFrame(g, torch, 1, lampsOf(shrine)))).toBeGreaterThan(
      sum(lightFrame(g, torch)),
    );
    expect(flickers(torch)).toHaveLength(3);
    expect(flickers(sight)).toEqual([1]);
    // The Torch flicker setting: off holds one frame, high steps further down than low.
    expect(flickers(torch, 'off')).toEqual([1]);
    expect(flickers(sight, 'high')).toEqual([1]);
    expect(Math.min(...flickers(torch, 'high'))).toBeLessThan(Math.min(...flickers(torch, 'low')));
  });
});
