// The pixel overland's icons and its light (docs/presentation-plan.md, V8). Icons sit on a layer
// of their own over the land: towns, dungeon mouths, groves, lairs, camps, roads off the map, the
// party's banner, and the compass, so moving the party never redraws the land. Both layers are lit
// by the hour (hex-art.ts's tint for the quarter of the day) through the material ramps: a warm
// morning, a plain day, a red evening, a dim blue night. Hexes only seen show paler, as the chart's
// wash did, and fog dims less than the land, so the known world stands out at night.
import type { DayTint } from '../hex-art.ts';
import type { HexCell } from '../hex-view.ts';
import { ICONS } from './bitmaps.ts';
import { blit } from './blit.ts';
import { BEYOND, newFrame, type Frame } from './frame.ts';
import { UNIT } from './hexgrid.ts';
import { FOG, SEEN } from './overland.ts';
import { hex, step, type Mat, type Rgb } from './palette.ts';
import { paletteFor } from './shade.ts';

/** The icons over a map `w` by `h` map units, on a clear layer. */
export function marksFrame(cells: readonly HexCell[], size: number, w: number, h: number): Frame {
  const f = newFrame(Math.ceil(w / UNIT), Math.ceil(h / UNIT));
  const at = (c: HexCell, dx = 0, dy = 0): [number, number] => [
    (c.cx + dx * size) / UNIT,
    (c.cy + dy * size) / UNIT,
  ];
  for (const c of cells) {
    if (c.site) blit(f, ICONS.town, ...at(c), 0);
    if (c.dungeon) blit(f, ICONS.dungeon, ...at(c), 0);
    if (c.grove) blit(f, ICONS.grove, ...at(c, 0, 0.1), 0);
    if (c.lair) blit(f, ICONS.lair, ...at(c), 0);
    if (c.camp) blit(f, ICONS.camp, ...at(c), 0);
    if (c.exit) blit(f, ICONS.exit, ...at(c), 0);
  }
  // The banner last, a little aside so the place it stands at still shows.
  for (const c of cells) if (c.party) blit(f, ICONS.party, ...at(c, 0.45, -0.15), 0);
  blit(f, ICONS.compass, (w - size * 1.9) / UNIT, (size * 1.9) / UNIT, 0);
  return f;
}

/** The colour the hour casts and how bright it leaves the land. */
export interface OverlandLight {
  tint: string;
  bright: number;
}

/** `a` mixed `t` of the way to `b`, as '#rrggbb'. */
export function mixHex(a: string, b: string, t: number): string {
  const [x, y] = [hex(a), hex(b)];
  return `#${x
    .map((c, i) => Math.round(c + ((y[i] as number) - c) * t))
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** The light for the quarter of the day's tint: none at all is plain daylight. */
export function overlandLight(tint?: DayTint): OverlandLight {
  if (!tint || tint.opacity === 0) return { tint: '#ffffff', bright: 1 };
  return {
    tint: mixHex('#ffffff', tint.color, Math.min(1, tint.opacity * 2)),
    bright: 1 - tint.opacity * 0.9,
  };
}

/** A pixel's brightness before it is dithered, by whether its hex is visited, seen, or fogged. */
export function overlandLevel(level: number, depth: number, bright: number): number {
  if (depth === FOG) return level * (0.6 + 0.4 * bright);
  if (depth === SEEN) return (0.32 + 0.68 * level) * bright;
  return level * bright;
}

/** A layer as RGBA under the hour's light; pixels never laid are clear. */
export function overlandRGBA(f: Frame, light: OverlandLight): Uint8ClampedArray<ArrayBuffer> {
  const pal = paletteFor(light.tint);
  const out = new Uint8ClampedArray(f.width * f.height * 4);
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++) {
      const i = y * f.width + x;
      const depth = f.depth[i] as number;
      if (depth === BEYOND) continue;
      const v = overlandLevel(f.level[i] as number, depth, light.bright);
      out.set((pal[f.mat[i] as Mat] as Rgb[])[step(v, x, y)] as Rgb, i * 4);
      out[i * 4 + 3] = 255;
    }
  return out;
}
