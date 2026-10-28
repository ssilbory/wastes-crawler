// Drawing data for dungeon furniture (docs/presentation-plan.md, V4): rubble, bones, an altar, a
// fountain, a brazier, each standing in a 48 by 48 box on y = 46 like the fight figures
// (figure-art.ts), and where each stands in the first-person view.
import type { Furniture } from '../data/schemas/index.ts';
import { ring, type Part } from './figure-art.ts';
import { standIn } from './dungeon-geometry.ts';
import { lightFrom, type Relief } from './figure-draw.ts';

const fill = (d: string, tone?: Part['tone']): Part => ({
  kind: 'fill',
  d,
  ...(tone ? { tone } : {}),
});
const line = (d: string, width = 2, tone?: Part['tone']): Part => ({
  kind: 'line',
  d,
  width,
  ...(tone ? { tone } : {}),
});
const cut = (d: string, width = 1): Part => ({ kind: 'cut', d, width });

const ART: Record<Furniture['kind'], Part[]> = {
  rubble: [
    fill('M6,46L9,40L15,38L19,41L24,35L31,36L35,40L41,41L43,46Z'),
    fill('M16,46L18,43L23,42L25,46Z'),
    cut('M15,38L17,46M24,35L22,46M31,36L33,46M19,41L25,40', 0.8),
  ],
  bones: [
    fill(ring(19, 41.4, 3.4)),
    fill('M17.2,43.4H20.8V46H17.2Z'),
    cut(`${ring(17.8, 41, 0.8)}${ring(20.2, 41, 0.8)}`, 0.7),
    cut('M18.3,45.4V44.2M19,45.4V44.2M19.7,45.4V44.2', 0.4),
    line('M25,45.2L36,42.8M9,45.6L14.6,44.8M28,43.6L31.6,45.6', 1.3),
    fill(`${ring(24.8, 45.3, 1)}${ring(36.2, 42.6, 1)}${ring(8.6, 45.7, 0.8)}`),
  ],
  altar: [
    fill('M13,30.6H35V46H13Z'),
    fill('M10,27.4H38V31.4H10Z'),
    cut('M13,34H35M24,34V46', 0.8),
    fill('M15.4,21.6H17.6V27.4H15.4ZM30.4,21.6H32.6V27.4H30.4Z'),
    fill(
      'M16.5,17.4Q18.4,20 16.5,21.6Q14.6,20 16.5,17.4ZM31.5,17.4Q33.4,20 31.5,21.6Q29.6,20 31.5,17.4Z',
      'flame',
    ),
  ],
  fountain: [
    fill('M7,35.6Q24,30.4 41,35.6L38,46H10Z'),
    fill('M22,22.6H26V35H22Z'),
    fill('M15,22.4Q24,18.6 33,22.4L31,25.6H17Z'),
    line('M17.4,24.6Q13,28.4 13.4,34M30.6,24.6Q35,28.4 34.6,34M24,18.6V13.4', 1.1, 'water'),
    line('M11,36.6Q24,33.2 37,36.6', 1.2, 'water'),
  ],
  brazier: [
    line('M18,46L22,34.4M30,46L26,34.4M24,46V34.4', 1.8),
    fill('M13,29.4Q24,38.6 35,29.4Z'),
    fill(
      'M15.6,29.4Q16,22 20,24.4Q21,16.6 24.6,14Q24.6,20.4 28.4,21.4Q31,24.4 32.4,29.4Z',
      'flame',
    ),
    fill('M20.4,29.4Q21,25 23.6,24.6Q24,20.6 26.4,19.6Q26,24 28,26Q29,27.6 28.6,29.4Z', 'flame'),
  ],
};

export function furnitureParts(kind: Furniture['kind']): Part[] {
  return ART[kind];
}

/** A piece of furniture in view: its parts, and its 48-unit box in view pixels. */
export interface FurnitureArt {
  kind: Furniture['kind'];
  parts: Part[];
  x: number;
  y: number;
  size: number;
  /** Which edge catches the party's light (figure-draw.ts). */
  light: Relief;
}

/** The furniture on the cell `depth` ahead and `lateral` across, standing in its middle. */
export function furnitureIn(kind: Furniture['kind'], depth: number, lateral: number): FurnitureArt {
  const { x, y, size } = standIn(depth + 0.5, lateral);
  return { kind, parts: ART[kind], x, y, size, light: lightFrom(x + size / 2) };
}
