// How a known trap looks in the first-person view (docs/presentation-plan.md, V1). A pressure plate
// for traps that harm, a tripwire for an alarm, the party's chalk ring around either, and marks by
// what the trap does: spike holes, needle holes and a poison stain, or filth. A disarmed trap stays
// in view, its plate wedged or its wire cut. All of it is laid out in the floor square's own
// perspective, and varies by a hash of the cell, never the RNG.
import type { Trap } from '../data/schemas/index.ts';
import { hash01, inQuad, inset, line, shape, type Point, type Quad } from './dungeon-detail.ts';

export type TrapEffect = Trap['effect']['kind'];

/** What the party knows of a trap on a cell: what it does, and whether it is still armed. */
export interface TrapLook {
  effect: TrapEffect;
  disarmed: boolean;
}

/** SVG paths for a trap's parts, each drawn in its own colour; empty strings draw nothing. */
export interface TrapArt {
  /** A pressure plate (the panel's own polygon), or none for a tripwire. */
  plate: boolean;
  chalk: string;
  holes: string;
  stain: string;
  stainKind: 'poison' | 'disease' | null;
  wire: string;
  wedge: string;
}

/** The plate within its floor square. */
export const PLATE = [0.22, 0.78] as const;

const pt = ([x, y]: Point) => `${x.toFixed(1)},${y.toFixed(1)}`;

/** A closed ring of points around (u, v) in a quad, each spoke stretched by `jitter` of the hash. */
function ring(q: Quad, u: number, v: number, r: number, sides: number, key = '', jitter = 0) {
  const points = Array.from({ length: sides }, (_, i) => {
    const a = (2 * Math.PI * i) / sides;
    const k = r * (1 + (hash01(`${key}:${i}`) - 0.5) * jitter);
    return inQuad(q, u + k * Math.cos(a), v + k * Math.sin(a));
  });
  return points;
}
const closed = (points: Point[]) => `M${points.map(pt).join('L')}Z`;
const open = (points: Point[]) => `M${points.map(pt).join('L')}`;

/** Small square holes centred on the given points of a quad. */
const holes = (q: Quad, at: [number, number][], size: number) =>
  at.map(([u, v]) => shape(inset(q, u - size, u + size, v - size, v + size))).join('');

/**
 * The art for a known trap on the floor square `floor`. `across` is the upright plane through the
 * middle of the cell, where a tripwire stretches wall to wall; `key` names the cell.
 */
export function trapArt(floor: Quad, across: Quad, key: string, look: TrapLook): TrapArt {
  const plate = inset(floor, PLATE[0], PLATE[1], PLATE[0], PLATE[1]);
  // The party's chalk: a ring around the danger, drawn a little unsteadily.
  const chalkRing = ring(floor, 0.5, 0.5, 0.45, 14, `${key}:chalk`, 0.12);
  // Once disarmed, the party strikes its ring through.
  const strike = look.disarmed ? line(floor, 0.12, 0.2, 0.88, 0.8) : '';
  const art: TrapArt = {
    plate: look.effect !== 'alarm',
    chalk: open([...chalkRing, chalkRing[0] as Point]) + strike,
    holes: '',
    stain: '',
    stainKind: null,
    wire: '',
    wedge: '',
  };
  if (look.effect === 'alarm') {
    // A wire across the cell at ankle height, pegged into each wall; disarmed, it hangs cut.
    const ankle = 0.9;
    art.wire = look.disarmed
      ? line(across, 0, ankle, 0.38, 0.97) + line(across, 1, ankle, 0.64, 0.98)
      : line(across, 0, ankle, 1, ankle);
    art.holes = holes(
      across,
      [
        [0.012, ankle],
        [0.988, ankle],
      ],
      0.012,
    );
    return art;
  }
  if (look.effect === 'damage') {
    const grid = [0.3, 0.5, 0.7];
    art.holes = holes(
      plate,
      grid.flatMap((u) => grid.map((v): [number, number] => [u, v])),
      0.065,
    );
  } else if (look.effect === 'poison') {
    art.holes = holes(
      plate,
      [
        [0.4, 0.42],
        [0.62, 0.6],
      ],
      0.05,
    );
    art.stain = closed(ring(plate, 0.52, 0.52, 0.32, 9, `${key}:stain`, 0.6));
    art.stainKind = 'poison';
  } else {
    // Filth spills over the plate's edge, flecked about.
    art.stain = closed(ring(floor, 0.48, 0.55, 0.26, 11, `${key}:filth`, 0.7));
    art.holes = holes(
      floor,
      [
        [0.2, 0.3],
        [0.78, 0.4],
        [0.7, 0.82],
      ],
      0.018,
    );
    art.stainKind = 'disease';
  }
  // A disarmed plate is wedged open at its near edge.
  if (look.disarmed) art.wedge = shape(inset(plate, 0.36, 0.64, 0.84, 1.1));
  return art;
}
