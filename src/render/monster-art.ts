// Drawing data for a monster in a fight slot (docs/presentation-plan.md, V3): one silhouette per
// figure named in data/content/monster-combat.json, in the same 48 by 48 box as figure-art.ts and
// standing on the same line. Armed folk are people with a fixed kit; beasts face left, toward the
// party.
import type { MonsterFigure } from '../data/schemas/index.ts';
import { personParts, ring, type Part, type PersonView } from './figure-art.ts';

const fill = (d: string): Part => ({ kind: 'fill', d });
const line = (d: string, width = 2): Part => ({ kind: 'line', d, width });
const cut = (d: string, width = 1): Part => ({ kind: 'cut', d, width });

const kit = (v: Omit<PersonView, 'kind' | 'body' | 'head'>, head: PersonView['head'] = 'plain') =>
  personParts({ kind: 'person', body: 'standard', head, ...v });

/** Stretched wide about the middle, for brutes and giants. */
const wide = (parts: Part[], by: number): Part[] =>
  parts.map((p) => ({
    ...p,
    d: p.d.replace(/([MLQH])([^a-zA-Z]*)/g, (_, cmd: string, args: string) => {
      const n = args.split(/[ ,]+/).filter(Boolean).map(Number);
      const out = n.map((v, i) => (cmd === 'H' || i % 2 === 0 ? 24 + (v - 24) * by : v));
      return `${cmd}${out.join(',')}`;
    }),
  }));

/** A scatter of specks for a swarm. */
const SPECKS: [number, number, number][] = [
  [8, 14, 1.4],
  [14, 9, 1.1],
  [19, 16, 1.6],
  [26, 10, 1.2],
  [31, 17, 1.5],
  [37, 11, 1.1],
  [42, 18, 1.3],
  [11, 22, 1.2],
  [17, 26, 1.7],
  [24, 21, 1.3],
  [30, 27, 1.6],
  [36, 23, 1.2],
  [41, 29, 1.4],
  [9, 31, 1.5],
  [15, 35, 1.1],
  [22, 32, 1.4],
  [28, 37, 1.2],
  [34, 34, 1.6],
  [40, 39, 1.1],
  [19, 41, 1.3],
  [26, 44, 1.1],
  [33, 43, 1.4],
];

const ART: Record<MonsterFigure, () => Part[]> = {
  commoner: () => kit({ garb: 'cloak', held: 'fist', shield: false }),
  soldier: () => kit({ garb: 'armor', held: 'spear', shield: true }),
  caster: () => kit({ garb: 'robe', held: 'staff', shield: false }),
  brute: () => wide(kit({ garb: 'cloak', held: 'axe', shield: false }, 'horns'), 1.2),
  giant: () => wide(kit({ garb: 'cloak', held: 'maul', shield: false }), 1.3),
  'walking-dead': () => [
    fill('M19.5,16Q26,12.6 31.5,16L28.4,30L18.6,29.2Z'),
    line('M29,17L41.4,19.4M27,18.4L39.6,23', 2.4),
    fill(ring(29.4, 11, 4)),
    fill('M18.6,29L28.4,30L27.4,46L24.2,46L23.6,36L21,46L17.8,46Z'),
    cut('M21.6,20.4H27M21.4,23.4H26.6M21.2,26.4H25.6', 0.9),
    cut('M27.6,10.2H28.8M30.6,10.2H31.8', 1.2),
  ],
  automaton: () => [
    fill('M20,3H28V11.4H20Z'),
    fill('M16,13H32V28.4H16Z'),
    fill('M11.6,14H15.2V29H11.6ZM32.8,14H36.4V29H32.8Z'),
    fill('M18,29.4H23V46H18ZM25,29.4H30V46H25Z'),
    cut('M21.4,7.2H26.6', 1.4),
    cut(ring(24, 20.6, 2.6), 1),
  ],
  beast: () => [
    fill(
      'M3,23L7,20L9,14.6L11.4,18.6L14.4,18.6Q17.4,21.6 22.4,21.6L35,21.6Q40,21.6 42,18.4Q44.6,15.6 47,13.6Q46.2,19.6 42,24.4L41.4,31L42.6,44L39.6,44L37.6,32.6L25,32.6L23.4,44L20.4,44L20.2,31.4Q16.4,29.6 14,26.4L9,26.6L4.6,25.8Z',
    ),
    cut('M8.6,21.6H10.2', 1.2),
  ],
  'great-beast': () => [
    fill(
      'M4,31Q4,25 9,23Q11,18.6 15,19.6Q21,13 31,14Q42.6,15 45,26.6L45,44L39,44L38,36.4L22,36.4L21,44L15,44L15,36.4Q8,36.4 4,31Z',
    ),
    fill(ring(13.2, 19.4, 2.2)),
    cut('M8.4,25.6H10', 1.2),
  ],
  grazer: () => [
    fill(
      'M10,22.4Q12,18 20,18L38,18Q44,18 44,24L43,30L42,44L39.4,44L38.4,32L22,32L21,44L18.4,44L18,31Q14,30 13,27.4L9.4,30.6Q4,30.6 4,25.4L6,20.4Z',
    ),
    line('M7.4,19.6Q3,14.4 6.6,9.6M10.4,18.6Q12.6,12.6 9.4,9', 1.8),
    line('M44,20Q47.4,26 46,31.4', 1.4),
    cut('M7.4,23.4H8.8', 1.2),
  ],
  crawler: () => [
    line('M17,30L9,21L3,41M19,31L13,24.6L8.4,44M21,32L23,25L29,44M23,32L29,24L35,43', 1.6),
    fill('M30,24.6Q42,24 43,31Q42,37.6 30,36.6Q22,36 22,30.6Q22,25 30,24.6Z'),
    fill(ring(17.4, 31, 5)),
    line('M13.2,32.4L8,34.6M13.6,29.4L8.4,28.6', 1.4),
    cut('M15.4,29.6H16.6M18.4,29.6H19.6', 1),
  ],
  serpent: () => [
    fill('M7,46Q7,37 24,37Q41,37 41,46Z'),
    line('M31,38.4Q37,28 26.6,24Q16,20.4 22,12.6', 5.2),
    fill('M18.6,10.6Q19,6.4 23.4,6.6Q28,7 27.6,11Q27,14.4 22.6,14Q18.6,13.6 18.6,10.6Z'),
    line('M18.8,10.4L14.6,9.4M14.6,9.4L13,7.8M14.6,9.4L13,11', 0.8),
    cut('M21.4,9.4H22.6', 1.2),
  ],
  winged: () => [
    fill('M22,20L3.4,7.6L6.6,14.8L2.6,17L7.6,21L3.6,25.4L12,26.4L20.6,28.6Z'),
    fill('M26,20L44.6,7.6L41.4,14.8L45.4,17L40.4,21L44.4,25.4L36,26.4L27.4,28.6Z'),
    fill('M19,18Q24,14 29,18L30,34L27.4,44L24.4,44L24,36.4L23.6,44L20.6,44L18,34Z'),
    fill(ring(24, 13, 4)),
    fill('M21.4,10.4L19.6,5.6L23,9.4ZM26.6,10.4L28.4,5.6L25,9.4Z'),
    cut('M22.2,12.6H23.2M24.8,12.6H25.8', 1.1),
  ],
  wyrm: () => [
    fill('M24,24.6L30,3.6L33.6,12L38,7.6L38,18L42.4,16L36,26.4Z'),
    fill(
      'M14,30.6Q16,24.4 26,24.4Q36,24.4 38,30.6L37,38.4L34,38.4L33,44L30,44L30,38.4L22,38.4L21,44L18,44L18,38.4Q14,36.4 14,30.6Z',
    ),
    line('M18.4,27Q12,18.6 10.4,10.6', 4.4),
    fill('M4.4,8.4L12,5.6L14.6,10.4L7.2,12.6Z'),
    line('M37,32.4Q46,34 44.4,41.6Q43.4,46 47.4,45', 3),
    cut('M9.4,8.4H10.8', 1.2),
  ],
  swarm: () => SPECKS.map(([x, y, r]) => fill(ring(x, y, r))),
  ooze: () => [
    fill('M6,46Q4,34 12,30Q14,20 22,22Q28,14 34,22Q44,24 42,34Q46,40 43,46Z'),
    fill(ring(9, 41, 1.6)),
    fill(ring(44.6, 43, 1.2)),
    cut('M19,30.6H20.6M27,29.6H28.6', 1.4),
  ],
  fungus: () => [
    fill('M19,21.6L29,21.6L30,40L27,40L27,46L25,46L24,41L23,46L21,46L21,40L18,40Z'),
    line('M19.4,26L13,32.4M28.6,26L35,32.4', 2.2),
    fill('M9.4,22.4Q9.4,7.6 24,7.6Q38.6,7.6 38.6,22.4Z'),
    cut(`${ring(17, 15, 2)}${ring(27.4, 12.6, 1.6)}${ring(32, 18, 1.4)}`, 0.9),
  ],
  tree: () => [
    fill('M20,46L21,30L18,22L22,24L24,16L26,24L30,21L27,30L28,46L26,46L24,40L22,46Z'),
    line('M19.4,23L12,14L9,15M12,14L13,8M28.6,22L36,13L39,14M36,13L35,7', 2),
    fill('M13.6,12Q12,4 20,4Q24,0.4 30,4Q37,4 35.4,12Q30,15 24,13Q18,15 13.6,12Z'),
    line('M20.6,44L16,46.4M27.4,44L32,46.4', 1.6),
  ],
  spirit: () => [
    fill(
      'M24,3Q36.4,15.6 33.4,28Q31.4,38.6 24,46Q26,38 20,36Q12,32 15,22Q16,16 20,13.6Q19,22 24,24.4Q22,14 24,3Z',
    ),
    cut('M22.2,27.4H23.4M26.2,27.4H27.4', 1.3),
  ],
};

export function monsterParts(figure: MonsterFigure): Part[] {
  return ART[figure]();
}

/** Figures that stand on two feet, or root, and so fall over on their side when down. */
export const UPRIGHT: ReadonlySet<MonsterFigure> = new Set<MonsterFigure>([
  'commoner',
  'soldier',
  'caster',
  'brute',
  'giant',
  'walking-dead',
  'automaton',
  'winged',
  'fungus',
  'tree',
  'spirit',
]);
