// The pixel view's frame before it is lit (docs/presentation-plan.md, V8): for each of its 320 by
// 240 pixels, the material, the brightness it would have in full light, and how many view planes
// it stands from the party. Surfaces are laid in far to near, as the vector view paints them, each
// texel found through its panel's perspective so the texture recedes with it.
import { VIEW_HEIGHT, VIEW_WIDTH } from '../dungeon-geometry.ts';
import type { Panel } from '../dungeon-panel.ts';
import { invert, project, squareToQuad } from './homography.ts';
import { ceiling, flag, plate, stairs } from './floors.ts';
import { MAT, type Mat } from './palette.ts';
import { CLEAR, levelOf, matOf, seedOf, texel } from './texel.ts';
import { door, dug, stone } from './walls.ts';

export interface Frame {
  width: number;
  height: number;
  mat: Uint8Array;
  level: Float32Array;
  depth: Float32Array;
}

/** Further than anything in view. */
export const BEYOND = 99;

/** An empty frame: nothing but the dark beyond. */
export function newFrame(width = VIEW_WIDTH, height = VIEW_HEIGHT): Frame {
  return {
    width,
    height,
    mat: new Uint8Array(width * height),
    level: new Float32Array(width * height),
    depth: new Float32Array(width * height).fill(BEYOND),
  };
}

/** Writes one pixel. */
export function put(f: Frame, i: number, m: Mat, level: number, depth: number): void {
  f.mat[i] = m;
  f.level[i] = level;
  f.depth[i] = depth;
}

type Texture = (u: number, v: number, seed: number) => number;

/** The texture laid on each kind of surface; figures have none. */
const TEXTURES: Partial<Record<Panel['kind'], Texture>> = {
  wall: stone,
  door,
  dug,
  floor: flag,
  ceiling,
  up: (u, v, s) => stairs(u, v, s, true),
  down: (u, v, s) => stairs(u, v, s, false),
  trap: plate,
  darkness: () => texel(MAT.darkness, 0),
};

/** How a face turned from the party darkens: side walls and the ceiling less lit than the far wall. */
function facing(p: Panel): number {
  if (p.kind === 'ceiling' || p.kind === 'up') return 0.72;
  if (p.kind === 'floor' || p.kind === 'down' || p.kind === 'trap') return 0.9;
  return p.span.near === p.span.far ? 1 : 0.8;
}

/**
 * How far from the party the point at (u, v) on a panel is, in view planes: the same all over a
 * face square to the view; along a side wall, from its near edge (u = 0) to its far one; across a
 * floor or ceiling, from its near edge (v = 1) to its far one.
 */
export function depthAt(p: Panel, u: number, v: number): number {
  const { near, far } = p.span;
  if (near === far) return near;
  return p.kind === 'floor' || p.kind === 'ceiling'
    ? far - v * (far - near)
    : near + u * (far - near);
}

/** Lays a textured panel into the frame; panels without a quad or a texture are left out. */
export function drawSurface(f: Frame, p: Panel): void {
  const tex = TEXTURES[p.kind];
  if (!p.quad || !tex) return;
  // A trap that is only a wire has no plate (its marks are drawn as shapes).
  if (p.kind === 'trap' && !p.trap?.plate) return;
  const inv = invert(squareToQuad(p.quad));
  if (!inv) return;
  const xs = p.quad.map((q) => q[0]);
  const ys = p.quad.map((q) => q[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const x1 = Math.min(f.width - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(f.height - 1, Math.ceil(Math.max(...ys)));
  const seed = seedOf(p.seed);
  const shade = facing(p);
  const uv: [number, number] = [0, 0];
  const E = 1e-6;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      project(inv, x + 0.5, y + 0.5, uv);
      const [u, v] = uv;
      if (u < -E || u > 1 + E || v < -E || v > 1 + E) continue;
      const cu = Math.min(1, Math.max(0, u));
      const cv = Math.min(1, Math.max(0, v));
      const t = tex(cu, cv, seed);
      if (t === CLEAR) continue;
      put(f, y * f.width + x, matOf(t), levelOf(t) * shade, depthAt(p, cu, cv));
    }
}
