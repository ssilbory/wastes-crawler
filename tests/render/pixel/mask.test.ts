import { describe, expect, it } from 'vitest';
import { newFrame } from '../../../src/render/pixel/frame.ts';
import {
  covers,
  edge,
  emptyMask,
  lift,
  outline,
  rim,
  ring,
  stamp,
  union,
  type Mask,
} from '../../../src/render/pixel/mask.ts';
import { MAT } from '../../../src/render/pixel/palette.ts';
import {
  drawSprite,
  furnitureSprite,
  pixels,
  type Sprite,
} from '../../../src/render/pixel/sprites.ts';
import { furniturePanel } from '../../../src/render/dungeon-furniture.ts';
import { IDENTITY } from '../../../src/render/pixel/affine.ts';

/** A mask from rows of '#' and '.'. */
function mask(x: number, y: number, rows: string[]): Mask {
  const m = emptyMask(x, y, (rows[0] as string).length, rows.length);
  rows.forEach((r, ly) => [...r].forEach((c, lx) => (m.on[ly * m.w + lx] = c === '#' ? 1 : 0)));
  return m;
}
const rows = (m: Mask) =>
  Array.from({ length: m.h }, (_, y) =>
    Array.from({ length: m.w }, (_, x) => (m.on[y * m.w + x] ? '#' : '.')).join(''),
  );

const block = mask(2, 2, ['....', '.##.', '.##.', '....']);

describe('pixel masks (docs/presentation-plan.md, V8)', () => {
  it('knows which frame pixels it covers', () => {
    expect(covers(block, 3, 3)).toBe(true);
    expect(covers(block, 2, 2)).toBe(false);
    expect(covers(block, 0, 0)).toBe(false);
    expect(covers(block, 9, 3)).toBe(false);
    expect(covers(block, 3, 9)).toBe(false);
  });

  it('finds its edges, its border, and the ring outside it', () => {
    // Shifted down and right, the lit edge faces up and left.
    expect(rows(edge(block, 1, 1))).toEqual(['....', '.##.', '.#..', '....']);
    expect(rows(rim(block))).toEqual(['....', '.##.', '.##.', '....']);
    expect(rows(ring(block))).toEqual(['......', '..##..', '.#..#.', '.#..#.', '..##..', '......']);
    expect(rows(union(block, mask(2, 2, ['#...', '....', '....', '...#'])))).toEqual([
      '#...',
      '.##.',
      '.##.',
      '...#',
    ]);
  });

  it('stamps, outlines behind but never in front, and lifts only its own pixels', () => {
    const f = newFrame(8, 8);
    // Something nearer already stands at (3, 1).
    f.depth[1 * 8 + 3] = 0.5;
    stamp(f, block, MAT.stone, 0.5, 2);
    expect(f.mat[3 * 8 + 3]).toBe(MAT.stone);
    outline(f, block, 2);
    expect(f.mat[3 * 8 + 2]).toBe(MAT.void);
    expect(f.depth[3 * 8 + 2]).toBe(2);
    expect(f.depth[1 * 8 + 3]).toBe(0.5);
    lift(f, block, 0.3, 2);
    expect(f.level[3 * 8 + 3]).toBeCloseTo(0.8);
    lift(f, block, 0.5, 2);
    expect(f.level[3 * 8 + 3]).toBe(1);
    lift(f, block, -0.5, 3);
    expect(f.level[3 * 8 + 3]).toBe(1);
    // Fire is left as bright as it burns.
    stamp(f, block, MAT.flame, 0.9, 2);
    lift(f, block, -0.5, 2);
    expect(f.level[3 * 8 + 3]).toBeCloseTo(0.9);
    // Pixels off the frame are skipped.
    stamp(f, mask(-1, -1, ['##', '##']), MAT.wood, 0.5, 1);
    expect(f.mat[0]).toBe(MAT.wood);
  });

  it('draws a sprite: outline, layers, a flame’s cooler edge, and a lit rim', () => {
    const shape = { d: '', stroke: null, matrix: IDENTITY, box: { x: 0, y: 0, w: 8, h: 8 } };
    const body = mask(0, 0, [
      '........',
      '..####..',
      '..####..',
      '..####..',
      '..####..',
      '........',
      '........',
      '........',
    ]);
    const fire = mask(0, 0, [
      '........',
      '........',
      '...##...',
      '...##...',
      '........',
      '........',
      '........',
      '........',
    ]);
    const sprite: Sprite = {
      layers: [
        { shape: { ...shape, d: 'body' }, mat: MAT.foe, level: 0.4, body: true },
        { shape: { ...shape, d: 'fire' }, mat: MAT.flame, level: 0.97, body: false },
      ],
      depth: 2,
      relief: [1, 1],
    };
    const f = newFrame(8, 8);
    drawSprite(f, sprite, (s) => (s.d === 'body' ? body : fire));
    expect(f.mat[1 * 8 + 1]).toBe(MAT.void);
    // The top-left corner of the body catches the light; the bottom-right is in shade.
    expect(f.level[1 * 8 + 2]).toBeCloseTo(0.7);
    expect(f.level[4 * 8 + 5]).toBeCloseTo(0.26);
    expect(f.mat[2 * 8 + 3]).toBe(MAT.flame);
    expect(f.level[2 * 8 + 3]).toBeCloseTo(0.5);
    // A sprite with no body is laid without outline or relief.
    const g = newFrame(8, 8);
    drawSprite(
      g,
      { ...sprite, layers: [sprite.layers[1] as Sprite['layers'][number]], relief: null },
      () => fire,
    );
    expect(g.mat.filter((m) => m === MAT.void)).toHaveLength(60);
  });

  it('turns a piece’s relief into whole pixels, and strokes its lines a unit wide unless told', () => {
    const f = newFrame();
    const near = furnitureSprite(furniturePanel('brazier', 1, 0), f);
    const far = furnitureSprite(furniturePanel('brazier', 3, 0), f);
    // At least a pixel each way the light falls, whatever the size.
    for (const s of [near, far]) {
      expect(Math.abs((s.relief as [number, number])[1])).toBeGreaterThanOrEqual(1);
    }
    // A figure lying down has no relief at all.
    expect(pixels(null, 40)).toBeNull();
    expect(pixels([0.4, -1.6], 96)).toEqual([1, -3]);
    // Straight ahead, the light falls from above and not from either side.
    expect((near.relief as [number, number])[0]).toBe(0);
    const art = furniturePanel('bones', 1, 0);
    const bare = {
      ...art,
      furniture: {
        ...(art.furniture as NonNullable<typeof art.furniture>),
        parts: [{ kind: 'line' as const, d: 'M0,0L1,1' }],
      },
    };
    expect(furnitureSprite(bare, f).layers[0]?.shape.stroke).toBe(1);
  });
});
