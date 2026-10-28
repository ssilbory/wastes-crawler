// More animals for monster-art.ts (docs/presentation-plan.md, V7: Sam's ask to split the shared
// beast figures): vermin, a big cat, a boar, a tusker, a unicorn, a shelled beast, and a lizard.
// Each faces left in the same 48 by 48 box, feet on y = 44 like the other beasts.
import { ring, type Part } from './figure-art.ts';

const fill = (d: string): Part => ({ kind: 'fill', d });
const line = (d: string, width = 2): Part => ({ kind: 'line', d, width });
const cut = (d: string, width = 1): Part => ({ kind: 'cut', d, width });

export type Animal = 'vermin' | 'big-cat' | 'boar' | 'tusker' | 'unicorn' | 'shelled' | 'lizard';

export const ANIMALS: Record<Animal, () => Part[]> = {
  /** A rat or a stoat: low and long, a pointed snout, a round ear, a long bare tail. */
  vermin: () => [
    line('M37,36Q44,34 45.4,40Q46.4,45 41,45.6', 1.3),
    fill(
      'M3,38.6Q4,35 9,33Q13,29.4 18,29Q24,27 31,28.6Q38,30 38.6,36.6L38,40.6L35,40.6L34.6,44L32,44L31.4,40.6L20,40.6L19.4,44L16.8,44L16.6,40Q12,40 9.6,39.6L4.6,40Z',
    ),
    fill(ring(13.4, 30, 2.4)),
    cut('M7.6,35.2H9', 1.1),
  ],
  /** A great cat: long and low, a round head with small ears, sabre teeth, the tail up. */
  'big-cat': () => [
    line('M42.6,25Q47,23 46,17.4Q45.4,13.6 47.4,11.6', 1.8),
    fill(
      'M4,26.4Q4,20.4 9.6,20Q12.6,18 15.6,20.6L19,23Q24,22 34,22Q42,22 43,28L43,33L44,44L41,44L39.4,35L24.4,35L23,44L20,44L19.2,34Q16,32.4 15,29.4Q11,31.4 7.4,30.6Q4,29.6 4,26.4Z',
    ),
    fill(`${ring(10.6, 19.6, 1.7)}${ring(14.2, 19.4, 1.5)}`),
    fill('M6.4,29.6L7.2,34L8.2,29.8ZM9.6,30L10.2,33.4L11,30.2Z'),
    cut('M7.2,24.4H8.8', 1.2),
  ],
  /** A boar: stocky, head low, a bristled ridge, tusks, and a thin tail. */
  boar: () => [
    line('M42.6,24.4Q46,25 45.6,29.4', 1.1),
    fill(
      'M3.6,30Q3.6,25 8.6,24L12,21Q20,16 32,17Q42,18 43,26L43,34L41.4,44L38.4,44L37.4,36L24.6,36L23.4,44L20.4,44L19.6,35.4Q14.6,34.4 12.4,32.4L8.4,34Q3.6,34 3.6,30Z',
    ),
    fill('M13.6,20.6L15.6,15L18,19.2L20.6,13.8L23,18.2L25.8,13.4L28.2,17.6L31,14L32.4,17.6Z'),
    cut('M6.4,31Q3.8,28.4 5.4,25.6', 1.3),
    cut('M9.2,26.4H10.6', 1.2),
  ],
  /** An elephantine grazer: a great domed body, a hanging trunk, a tusk, a broad ear. */
  tusker: () => [
    fill(
      'M10,22Q12,11 26,11Q42,11 44.4,24L44.4,44L38.4,44L37.4,34L23.4,34L22.4,44L16.4,44L16,32Q12,32 10,28Z',
    ),
    line('M11.4,24Q5,30 7,38Q8,41.4 4.6,42.4', 3.6),
    cut('M12.4,27.4Q7,30.8 5.4,26.8', 1.5),
    cut('M19,15.4Q14,21.4 19.4,27', 1),
    cut('M13.6,19H15', 1.3),
  ],
  /** A unicorn: a horse with its head high, a horn, a flowing tail, slender legs. */
  unicorn: () => [
    line('M42.6,23Q47.4,28 45.4,37.4', 2.2),
    fill(
      'M5.4,15.4L9.4,9.6Q12.6,8.2 15,10.4L19,17Q22,21 26,21L38,21Q43,21 43,27L42.6,31L43.6,44L41,44L39.6,33L25,33L23.6,44L21,44L20.4,32Q17,30 16,25.4L12,19Q9,21 5.8,19.4Z',
    ),
    line('M11.6,9.4L13.8,2.4', 1.3),
    line('M14,10.6Q17,13 18.4,17.6', 1.6),
    cut('M9.4,13.2H10.8', 1.2),
  ],
  /** A shelled or plated beast: a high domed shell, stubby legs, a head thrust out. */
  shelled: () => [
    fill('M13,35H18.4L17.6,44H13ZM33.6,35H39L39,44H34.4Z'),
    fill('M11.4,32Q4.6,29.4 3,33.4Q3,38 9,37.6L12.4,36.6Z'),
    fill('M9.6,36Q10.6,19.4 26,19.4Q41.4,19.4 42.4,36Z'),
    cut('M17.6,23L21.4,36M26,19.4V36M34.4,23L30.6,36M12.4,29.4H39.6', 0.9),
    cut('M5.4,33.2H6.8', 1.1),
  ],
  /** A great lizard: long and low, splayed legs, a spined back, a long tail. */
  lizard: () => [
    fill(
      'M2.6,33.4Q3.6,29.4 8.6,29.6L14,30Q20,27 30,28Q38,28.6 41,32Q45,36 47.4,42.4Q42,38.4 38,37.4L36.4,37.4L37.4,41.6L40,44L34,44L32,38.4L20,38.4L18.4,41.6L20.6,44L14.4,44L14,38.4Q11,36.4 9,35.4L4,35.6Z',
    ),
    fill('M18,28.4L20,25L22,28ZM24,27.8L26,24.4L28,27.8ZM30,28.2L32,25.2L34,28.8Z'),
    cut('M6.6,31.4H8', 1.2),
  ],
};
