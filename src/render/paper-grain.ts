// The overland map's paper grain (docs/presentation-plan.md, V7): specks and short fibres in one
// square tile that HexArt.tsx repeats as an SVG pattern over the land. A pattern, not a filter, so
// it costs nothing to zoom or scroll. Placement comes from the hash, so the paper never changes.
import { hash01, pt } from './dungeon-quad.ts';

export interface Grain {
  /** The tile's side in map units. */
  tile: number;
  /** Small dark flecks, filled. */
  specks: string;
  /** Short curled fibres, stroked. */
  fibres: string;
}

/**
 * hash01 scrambled once more (the murmur3 finaliser): keys this alike ("s1:x", "s2:x") come out of
 * FNV-1a close together, which strings the specks out in dotted lines.
 */
function scatter(key: string): number {
  let x = Math.floor(hash01(`grain:${key}`) * 0x100000000);
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 0x100000000;
}

const h = (key: string, lo: number, hi: number) => lo + (hi - lo) * scatter(key);

/**
 * A tile `tile` units square holding `specks` flecks and `fibres` fibres, each kept a margin in
 * from the edges so the pattern never cuts one in half at a seam.
 */
export function paperGrain(tile: number, specks = 30, fibres = 6): Grain {
  const margin = tile * 0.08;
  const at = (key: string) =>
    [h(`${key}:x`, margin, tile - margin), h(`${key}:y`, margin, tile - margin)] as const;
  const flecks = Array.from({ length: specks }, (_, i) => {
    const [x, y] = at(`s${i}`);
    const w = h(`s${i}:w`, 0.25, 0.6);
    return `M${pt([x, y])}h${w.toFixed(2)}v${w.toFixed(2)}h${(-w).toFixed(2)}Z`;
  });
  const strands = Array.from({ length: fibres }, (_, i) => {
    const [x, y] = at(`f${i}`);
    const length = h(`f${i}:l`, 1.5, Math.min(4.5, margin));
    const angle = h(`f${i}:a`, 0, Math.PI);
    const bend = h(`f${i}:b`, -0.6, 0.6);
    const [dx, dy] = [Math.cos(angle) * length, Math.sin(angle) * length];
    const control = pt([dx / 2 - dy * bend * 0.5, dy / 2 + dx * bend * 0.5]);
    return `M${pt([x, y])}q${control} ${pt([dx, dy])}`;
  });
  return { tile, specks: flecks.join(''), fibres: strands.join('') };
}
