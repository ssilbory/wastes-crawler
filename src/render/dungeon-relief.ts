// Relief for the first-person view's surfaces (docs/presentation-plan.md, V7): each stone lit
// along one edge and shadowed along the other so it stands proud of its mortar, some stones a
// shade lighter, hairline cracks, grime where a wall meets the floor, and grain down a door's
// planks. Every piece is a fill or a line inside the panel's own perspective quad, so it recedes
// with the wall and costs no SVG filter. Variation comes from the hash, never the RNG.
import { hash01, inQuad, inset, pt, shape, type Quad } from './dungeon-quad.ts';

/** One stone, plank, or tread by its fractions across (u) and down (v) its panel. */
export interface Stone {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  /** Its own key, for its shade and cracks. */
  key: string;
}

/** What gives a surface depth, each drawn over the panel's fill and under its mortar. */
export interface Relief {
  /** Stones a shade lighter than the rest. */
  lights: string;
  /** The lit strip along each stone's edge that faces the light. */
  bevels: string;
  /** The shadowed strip along each stone's other edge. */
  undersides: string;
  /** Hairline cracks in stone, or grain down a plank. */
  cracks: string;
  /** Bands of grime up from the foot of a wall, each laid over the last: darkest at the floor. */
  grime: string[];
}

/** Below this a stone's hash darkens it (dungeon-detail.ts); above 1 minus LIGHT_STONE, lightens. */
export const DARK_STONE = 0.17;
export const LIGHT_STONE = 0.15;
/** About one stone in eight is cracked. */
export const CRACKED = 0.12;
/** Where the grime bands start, as fractions down the wall. */
export const GRIME = [0.72, 0.86, 0.95];

export const NO_RELIEF: Relief = { lights: '', bevels: '', undersides: '', cracks: '', grime: [] };

/** A crack from a point on a stone's top edge, zigzagging partway down it. */
function crack(q: Quad, s: Stone): string {
  const w = s.u1 - s.u0;
  const h = s.v1 - s.v0;
  const u = s.u0 + w * (0.2 + 0.6 * hash01(`${s.key}:cu`));
  const depth = 0.45 + 0.45 * hash01(`${s.key}:cv`);
  const steps = [0, 1, 2, 3].map((i) => {
    const swing = i === 0 ? 0 : (i % 2 ? 1 : -1) * w * 0.07 * (0.5 + hash01(`${s.key}:c${i}`));
    return inQuad(q, u + swing, s.v0 + (h * depth * i) / 3);
  });
  return `M${steps.map(pt).join('L')}`;
}

/**
 * Relief for a surface laid as stones: lit along the edge toward the light and shadowed along the
 * other. A wall is lit along each stone's top (`lit: 'top'`); a floor, seen from above with the
 * light behind the viewer, along each stone's near edge (`lit: 'near'`), the gap beyond it in
 * shadow. With `grime`, the wall darkens toward its foot; with `cracks`, a few stones crack.
 */
export function relief(
  q: Quad,
  stones: Stone[],
  opts: { lit: 'top' | 'near'; grime: boolean; cracks: boolean },
): Relief {
  const lights: string[] = [];
  const bevels: string[] = [];
  const undersides: string[] = [];
  const cracks: string[] = [];
  for (const s of stones) {
    const du = (s.u1 - s.u0) * 0.03;
    const dv = (s.v1 - s.v0) * 0.06;
    const lip = (s.v1 - s.v0) * 0.13;
    const foot = (s.v1 - s.v0) * 0.18;
    const [u0, u1] = [s.u0 + du, s.u1 - du];
    const [top, bottom] = [s.v0 + dv, s.v1 - dv];
    const lit = opts.lit === 'top' ? [top, top + lip] : [bottom - lip, bottom];
    const dark = opts.lit === 'top' ? [s.v1 - foot, s.v1] : [s.v0, s.v0 + foot];
    bevels.push(shape(inset(q, u0, u1, lit[0] as number, lit[1] as number)));
    undersides.push(shape(inset(q, s.u0, s.u1, dark[0] as number, dark[1] as number)));
    if (hash01(s.key) > 1 - LIGHT_STONE) lights.push(shape(inset(q, s.u0, s.u1, s.v0, s.v1)));
    if (opts.cracks && hash01(`${s.key}:crack`) < CRACKED) cracks.push(crack(q, s));
  }
  return {
    lights: lights.join(''),
    bevels: bevels.join(''),
    undersides: undersides.join(''),
    cracks: cracks.join(''),
    grime: opts.grime ? GRIME.map((v) => shape(inset(q, 0, 1, v, 1))) : [],
  };
}

/** Grain down each plank: two wavering lines running its length, placed by the hash. */
export function grain(q: Quad, planks: Stone[]): string {
  return planks
    .flatMap((p) =>
      [0, 1].map((n) => {
        const w = p.u1 - p.u0;
        const u = p.u0 + w * (0.25 + 0.5 * n + (hash01(`${p.key}:g${n}`) - 0.5) * 0.2);
        const points = [0, 1, 2, 3, 4].map((i) => {
          const sway = (hash01(`${p.key}:g${n}:${i}`) - 0.5) * w * 0.12;
          return inQuad(q, u + sway, p.v0 + ((p.v1 - p.v0) * i) / 4);
        });
        return `M${points.map(pt).join('L')}`;
      }),
    )
    .join('');
}
