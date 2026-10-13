// Drawing data for a person in a fight slot (docs/presentation-plan.md, V3): a silhouette put
// together from its people's build and head, its garb, the weapon in its hand, and its shield.
// Everything sits in a 48 by 48 box standing on y = 46; src/ui/arena/Figure.tsx draws the parts.
// Monster figures, which reuse these for the armed folk, are in monster-art.ts.
import type { Held, PeopleLook } from '../data/schemas/index.ts';
import type { FigureView } from './figure-view.ts';

/**
 * One piece of a figure: a filled shape, an inked line, or a cut line drawn in the slot's colour
 * to carve a detail out of the silhouette. `width` is the stroke for lines and cuts.
 */
export interface Part {
  kind: 'fill' | 'line' | 'cut';
  d: string;
  width?: number;
  /** A part in its own colour: fire, or water (furniture-art.ts). */
  tone?: 'flame' | 'water';
}

export type PersonView = Extract<FigureView, { kind: 'person' }>;

const fill = (d: string): Part => ({ kind: 'fill', d });
const line = (d: string, width = 2): Part => ({ kind: 'line', d, width });
const cut = (d: string, width = 1): Part => ({ kind: 'cut', d, width });

/** A circle as a path, so every part is a path. */
export const ring = (cx: number, cy: number, r: number) =>
  `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;

/** Moves every number pair in a path by (dx, dy); arcs keep their radii. */
export function shift(part: Part, dx: number, dy: number): Part {
  if (dx === 0 && dy === 0) return part;
  // Only absolute commands carry positions; relative ones and arc radii move with them.
  const d = part.d.replace(/([MLQHV])([^a-zA-Z]*)/g, (_, cmd: string, args: string) => {
    const n = args.split(/[ ,]+/).filter(Boolean).map(Number);
    const moved = n.map((v, i) =>
      cmd === 'H' ? v + dx : cmd === 'V' ? v + dy : i % 2 === 0 ? v + dx : v + dy,
    );
    return `${cmd}${moved.join(',')}`;
  });
  return { ...part, d };
}

const HEAD = ring(24, 9, 4.2);
const TORSO = 'M17,15.5Q24,13 31,15.5L30,29L18,29Z';
const ARMS = 'M17.6,16.5L14,28M30.4,16.5L34,27';
const LEGS = 'M18.5,29L29.5,29L29,46L25.5,46L24,34L22.5,46L19,46Z';

/** The marks a people carries on its head. */
const HEADS: Record<PeopleLook['head'], Part[]> = {
  plain: [],
  ears: [fill('M20.2,8L14.5,5L20.4,11ZM27.8,8L33.5,5L27.6,11Z')],
  horns: [
    fill('M21.2,6.3Q16.6,5.2 16.8,0.8Q18.6,4 22,4.6ZM26.8,6.3Q31.4,5.2 31.2,0.8Q29.4,4 26,4.6Z'),
  ],
  tusks: [cut('M22.4,12.2V10.4M25.6,12.2V10.4', 0.9)],
  beard: [fill('M20.2,10Q24,21 27.8,10Z'), cut('M20.6,11.5Q24,20 27.4,11.5', 0.8)],
};

/** Garb over the body: on top for armor and a robe, behind for a cloak. */
const GARB: Record<PersonView['garb'], { back: Part[]; front: Part[] }> = {
  armor: {
    back: [],
    front: [
      fill('M13.6,14.6Q17,12.4 21,14V19.4H13.6ZM34.4,14.6Q31,12.4 27,14V19.4H34.4Z'),
      fill('M19.4,9.4Q19.4,3.4 24,3.4Q28.6,3.4 28.6,9.4V11.2H19.4Z'),
      cut('M20.4,8.6H27.6', 1.1),
      cut('M18.4,25.6H29.6', 0.9),
    ],
  },
  robe: {
    back: [],
    front: [
      fill('M18.2,27.5L29.8,27.5L33.6,46L14.4,46Z'),
      fill('M18.8,10.4Q18.8,2.8 24,2.2Q29.2,2.8 29.2,10.4L29.4,13.6H18.6Z'),
      cut('M24,30V45', 0.8),
    ],
  },
  cloak: {
    back: [fill('M17.2,15L13.6,35.6Q24,38.2 34.4,35.6L30.8,15Z')],
    front: [cut('M17.4,17.5L15,34', 0.8)],
  },
};

/** The weapon in the right hand, which rests at about (34, 27). */
const HELD: Record<Held, Part[]> = {
  blade: [line('M34,27.5L38.6,9', 2), line('M32,23.6L37.2,25.2', 1.6)],
  great: [line('M33.6,30L40.4,2.5', 2.8), line('M31.2,24.6L37.8,26.6', 2)],
  dagger: [line('M34,27.5L36.2,19.5', 1.8), line('M32.8,24.6L36.4,25.6', 1.2)],
  axe: [line('M34,30L37.4,9.5', 1.8), fill('M36.2,8.6Q42.6,7.6 43.4,14.4Q40.2,13.2 36.6,15.4Z')],
  mace: [line('M34,28.5L36,14', 1.8), fill(ring(36.2, 12.4, 2.8))],
  maul: [line('M34,32L37.2,7', 2), fill('M32.4,3.6L41.6,5.4L40.6,10.2L31.4,8.4Z')],
  spear: [line('M35,44V5.5', 1.7), fill('M35,0.6L37.2,6.4H32.8Z')],
  polearm: [
    line('M35,46V3', 1.8),
    fill('M35,5.6Q41.4,4.6 41.4,11.4Q38.2,10.2 35,12.6Z'),
    fill('M35,0.4L36.4,4H33.6Z'),
  ],
  staff: [line('M35,46V6.5', 2), fill(ring(35, 5, 2.4))],
  bow: [line('M33,9Q43.5,26 33,43', 1.8), line('M33,9V43', 0.6)],
  gun: [line('M30.6,25.2L43,21.6', 3.6), line('M41.6,20.6L42.2,23', 1.2)],
  fist: [],
};

const SHIELD: Part[] = [fill(ring(13.6, 25, 6.2)), cut(ring(13.6, 25, 4.2), 0.9)];

/** A centaur's horse body; its rider half stands at the front of it. */
const HORSE: Part[] = [
  fill(
    'M10,27Q10,22.5 16,22.5L38,22.5Q44,22.5 44,28.5L44,33L41,33L41,46L38,46L37,34.5L19,34.5L18,46L15,46L15,33.5Q10,32.5 10,27Z',
  ),
  line('M43.6,24.6Q48,30 46.2,40', 2.2),
];

/** Where a centaur's rider half sits on its horse body. */
const RIDER = { dx: -7, dy: -2 };

/** The parts of a person, back to front. */
export function personParts(v: PersonView): Part[] {
  const garb = GARB[v.garb];
  const upper = [
    ...garb.back,
    fill(TORSO),
    line(ARMS, 2.6),
    fill(HEAD),
    ...garb.front,
    // Ears, horns, and beards show past a hood or a helm.
    ...HEADS[v.head],
    ...HELD[v.held],
    ...(v.shield ? SHIELD : []),
  ];
  // A cloak would hang over the horse.
  if (v.body === 'centaur')
    return [...HORSE, ...upper.slice(garb.back.length).map((p) => shift(p, RIDER.dx, RIDER.dy))];
  return [...upper.slice(0, garb.back.length), fill(LEGS), ...upper.slice(garb.back.length)];
}

/** How much smaller a small people stands, scaled about its feet. */
export const SMALL_SCALE = 0.8;

/** Anyone not large stands this tall in its slot, so the large tower over them. */
export const NORMAL_SCALE = 0.86;

/**
 * The SVG transform for a figure: its size, scaled about its feet, and its fall when down. An
 * upright figure lies on its side on the ground; a beast rolls onto its back.
 */
export function figureTransform(v: FigureView, down: boolean, upright: boolean): string {
  const s =
    (v.kind === 'monster' && v.large ? 1 : NORMAL_SCALE) *
    (v.kind === 'person' && v.body === 'small' ? SMALL_SCALE : 1);
  const size = `translate(${round(24 - 24 * s)},${round(46 - 46 * s)}) scale(${round(s)})`;
  if (!down) return size;
  return `${size} ${upright ? 'translate(0,10) rotate(90,24,24)' : 'translate(0,60) scale(1,-1)'}`;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
