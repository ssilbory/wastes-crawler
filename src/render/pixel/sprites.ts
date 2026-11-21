// What stands in the pixel view as sprites (docs/presentation-plan.md, V8): furniture, the people
// and foes in cells ahead, a pending encounter's foes, and a known trap's marks. Each is the vector
// view's own art (furniture-art.ts, figure-art.ts, trap-art.ts) filled into whole pixels by a
// rasterizer the UI supplies, then outlined in black and lit on the rim facing the party's light.
import type { Part } from '../figure-art.ts';
import { drawFigure, type Relief } from '../figure-draw.ts';
import type { FigureView } from '../figure-view.ts';
import type { Panel } from '../dungeon-panel.ts';
import { CHEST } from '../dungeon-occupants.ts';
import type { PortraitFigure } from '../encounter-portrait.ts';
import { compose, IDENTITY, parseTransform, scale, translate, type Affine } from './affine.ts';
import type { Frame } from './frame.ts';
import { edge, lift, outline, rim, stamp, union, type Mask } from './mask.ts';
import { MAT, type Mat } from './palette.ts';

/** A box of the frame in whole pixels. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A path to fill (or, with a width, to stroke), mapped into view pixels and cut to a box. */
export interface Shape {
  d: string;
  stroke: number | null;
  matrix: Affine;
  box: Box;
}

/** Fills a shape into whole pixels; the UI does it with the browser's own path filling. */
export type Rasterize = (s: Shape) => Mask;

interface Layer {
  shape: Shape;
  mat: Mat;
  level: number;
  /** Part of the body, which is outlined and takes the light on its rim. */
  body: boolean;
}

export interface Sprite {
  layers: Layer[];
  depth: number;
  /** The shift in view pixels that finds its lit and shaded edges, or none. */
  relief: Relief | null;
}

/** How each part of a kind of piece is coloured: the body, its lines, and its cuts. */
interface Look {
  body: [Mat, number];
  cut: [Mat, number];
}

const LOOKS = {
  stone: { body: [MAT.stone, 0.56], cut: [MAT.stone, 0.18] },
  chest: { body: [MAT.wood, 0.52], cut: [MAT.wood, 0.16] },
  // Foes are dark shapes whose eyes and visors catch the light.
  foe: { body: [MAT.foe, 0.4], cut: [MAT.glint, 0.75] },
  captive: { body: [MAT.cloth, 0.62], cut: [MAT.cloth, 0.22] },
} satisfies Record<string, Look>;

const TONES: Record<NonNullable<Part['tone']>, [Mat, number]> = {
  flame: [MAT.flame, 0.97],
  water: [MAT.water, 0.66],
};

/** The pixel box around a piece's 48-unit box, a pixel spare all round, cut to the frame. */
function boxOf(x: number, y: number, size: number, f: { width: number; height: number }): Box {
  const x0 = Math.max(0, Math.floor(x) - 1);
  const y0 = Math.max(0, Math.floor(y) - 1);
  const x1 = Math.min(f.width, Math.ceil(x + size) + 1);
  const y1 = Math.min(f.height, Math.ceil(y + size) + 1);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** A relief shift in a 48-unit box as whole view pixels, at least one where there is any. */
export function pixels(r: Relief | null, size: number): Relief | null {
  if (!r) return null;
  const px = (v: number) =>
    v === 0 ? 0 : Math.sign(v) * Math.max(1, Math.round((Math.abs(v) * size) / 48));
  return [px(r[0]), px(r[1])];
}

/** The layers of a piece drawn from `parts` with its look, through `matrix` into `box`. */
function layers(parts: Part[], look: Look, matrix: Affine, box: Box): Layer[] {
  return parts.map((p) => {
    const [mat, level] = p.tone ? TONES[p.tone] : p.kind === 'cut' ? look.cut : look.body;
    return {
      shape: { d: p.d, stroke: p.kind === 'fill' ? null : (p.width ?? 1), matrix, box },
      mat,
      level,
      body: !p.tone && p.kind !== 'cut',
    };
  });
}

type Size = { width: number; height: number };

/** A figure standing in a 48-unit box at (x, y). */
function figureSprite(
  figure: FigureView,
  at: { x: number; y: number; size: number; light: Relief; mirror: boolean },
  look: Look,
  depth: number,
  f: Size,
): Sprite {
  const drawn = drawFigure(figure, false, at.light, at.mirror);
  const place = compose(translate(at.x, at.y), scale(at.size / 48));
  const matrix = compose(place, parseTransform(drawn.transform));
  const box = boxOf(at.x, at.y, at.size, f);
  return {
    layers: layers(drawn.parts, look, matrix, box),
    depth,
    relief: pixels(drawn.relief, at.size),
  };
}

/** A piece of furniture standing in its cell. */
export function furnitureSprite(p: Panel, f: Size): Sprite {
  const art = p.furniture as NonNullable<Panel['furniture']>;
  const matrix = compose(translate(art.x, art.y), scale(art.size / 48));
  const box = boxOf(art.x, art.y, art.size, f);
  return {
    layers: layers(art.parts, LOOKS.stone, matrix, box),
    depth: p.span.near,
    relief: pixels(art.light, art.size),
  };
}

/** Who or what stands in a cell: its figures and any chest, back to front. */
export function occupantSprites(p: Panel, f: Size): Sprite[] {
  const o = p.occupant as NonNullable<Panel['occupant']>;
  return o.pieces.map((piece) => {
    if (piece.figure)
      return figureSprite(
        piece.figure,
        piece,
        piece.foe ? LOOKS.foe : LOOKS.captive,
        p.span.near,
        f,
      );
    const matrix = compose(translate(piece.x, piece.y), scale(piece.size / 48));
    const box = boxOf(piece.x, piece.y, piece.size, f);
    return {
      layers: layers(CHEST, LOOKS.chest, matrix, box),
      depth: p.span.near,
      relief: pixels(piece.light, piece.size),
    };
  });
}

/** A pending encounter's foe, standing ahead. */
export const foeSprite = (foe: PortraitFigure, f: Size): Sprite =>
  figureSprite(foe.figure, foe, LOOKS.foe, foe.depth, f);

/** A known trap's marks on its floor: stain, holes, a tripwire, a wedge, and the party's chalk. */
export function trapSprite(p: Panel, f: Size): Sprite {
  const art = p.trap as NonNullable<Panel['trap']>;
  const box = { x: 0, y: 0, w: f.width, h: f.height };
  const shape = (d: string, stroke: number | null): Shape => ({ d, stroke, matrix: IDENTITY, box });
  const marks: [string, number | null, Mat, number][] = [
    [art.stain, null, art.stainKind === 'poison' ? MAT.poison : MAT.filth, 0.5],
    [art.holes, null, MAT.void, 0],
    [art.wire, 1.1, MAT.iron, 0.82],
    [art.wedge, null, MAT.wood, 0.45],
    [art.chalk, 1.1, MAT.chalk, 0.8],
  ];
  return {
    layers: marks
      .filter(([d]) => d !== '')
      .map(([d, stroke, mat, level]) => ({ shape: shape(d, stroke), mat, level, body: false })),
    depth: p.span.near,
    relief: null,
  };
}

/**
 * Lays a sprite into the frame: an outline around its body over what lies behind, its layers in
 * order, then its lit rim brightened and its shaded edge darkened.
 */
export function drawSprite(f: Frame, s: Sprite, raster: Rasterize): void {
  const masks = s.layers.map((l) => raster(l.shape));
  const body = s.layers.reduce<Mask | null>(
    (acc, l, i) => (l.body ? (acc ? union(acc, masks[i] as Mask) : (masks[i] as Mask)) : acc),
    null,
  );
  if (body) outline(f, body, s.depth);
  s.layers.forEach((l, i) => {
    const m = masks[i] as Mask;
    stamp(f, m, l.mat, l.level, s.depth);
    // A flame burns white-hot inside and cooler at its edges.
    if (l.mat === MAT.flame) stamp(f, rim(m), MAT.flame, 0.5, s.depth);
  });
  if (body && s.relief) {
    const [dx, dy] = s.relief;
    lift(f, edge(body, dx, dy), 0.3, s.depth);
    lift(f, edge(body, -dx, -dy), -0.14, s.depth);
  }
}
