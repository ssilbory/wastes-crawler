import { describe, expect, it } from 'vitest';
import { ceiling, flag, plate, stairs } from '../../../src/render/pixel/floors.ts';
import { MAT, type Mat } from '../../../src/render/pixel/palette.ts';
import { CLEAR, levelOf, matOf, seedOf, TEXELS } from '../../../src/render/pixel/texel.ts';
import { door, dug, LEAF, stone } from '../../../src/render/pixel/walls.ts';

type Tex = (u: number, v: number, seed: number) => number;

/** Every texel of a face, sampled at texel centres, over a few seeds. */
function sample(tex: Tex, seeds = ['3,4:n', '9,1:w', '0,0:e', '5,5:s', '7,2:n', '2,8:e']) {
  const out: number[] = [];
  for (const s of seeds)
    for (let y = 0; y < TEXELS; y++)
      for (let x = 0; x < TEXELS; x++)
        out.push(tex((x + 0.5) / TEXELS, (y + 0.5) / TEXELS, seedOf(s)));
  return out;
}
const mats = (ts: number[]) => new Set(ts.filter((t) => t !== CLEAR).map(matOf));
const at = (tex: Tex, u: number, v: number, seed = 'x') => tex(u, v, seedOf(seed));

describe('pixel wall textures (docs/presentation-plan.md, V8)', () => {
  it('lays coursed stone with mortar, cracks, and moss low down', () => {
    const ts = sample(stone);
    expect(mats(ts)).toEqual(new Set<Mat>([MAT.stone, MAT.mortar, MAT.moss]));
    // The same texel every time: a wall looks the same on every visit.
    expect(at(stone, 0.3, 0.4)).toBe(at(stone, 0.3, 0.4));
    // Mortar along the top of each course.
    expect(matOf(at(stone, 0.5, 0.5 / TEXELS))).toBe(MAT.mortar);
    // Moss only on the lower courses.
    const high = sample((u, v, s) => stone(u, v * 0.5, s));
    expect(mats(high).has(MAT.moss)).toBe(false);
    // Bevels: a block's top row is brighter than its bottom row on average.
    const row = (r: number) =>
      sample((u, _v, s) => stone(u, (r + 0.5) / TEXELS, s))
        .filter((t) => matOf(t) === MAT.stone)
        .reduce((a, t, _i, all) => a + levelOf(t) / all.length, 0);
    expect(row(9)).toBeGreaterThan(row(15));
  });

  it('frames a planked door with iron bands, studs, and a ring', () => {
    const ts = sample(door);
    expect(mats(ts)).toEqual(new Set<Mat>([MAT.stone, MAT.mortar, MAT.moss, MAT.wood, MAT.iron]));
    expect(matOf(at(door, 0.1, 0.5))).not.toBe(MAT.wood);
    // The frame, the leaf, and a band.
    expect(matOf(at(door, LEAF.u0 - 1.5 / TEXELS, 0.6))).toBe(MAT.wood);
    expect(matOf(at(door, 0.4, 0.5))).toBe(MAT.wood);
    expect(matOf(at(door, 0.4, LEAF.v0 + 0.16 * (1 - LEAF.v0)))).toBe(MAT.iron);
    // The ring: iron about its middle, one half catching more light than the other.
    const ringU = LEAF.u0 + 0.72 * (LEAF.u1 - LEAF.u0);
    const ringV = LEAF.v0 + 0.56 * (1 - LEAF.v0);
    const ring = [-4, -3, -2, 2, 3, 4]
      .map((dv) => at(door, ringU, ringV + dv / TEXELS))
      .filter((t) => matOf(t) === MAT.iron);
    expect(new Set(ring.map(levelOf)).size).toBe(2);
  });

  it('tears a ragged hole open to the floor, with a broken rim and rubble at its foot', () => {
    const ts = sample(dug);
    expect(ts).toContain(CLEAR);
    expect(at(dug, 0.5, 0.6)).toBe(CLEAR);
    expect(at(dug, 0.02, 0.1)).not.toBe(CLEAR);
    // Rubble heaped across the foot, inside the hole.
    expect(matOf(at(dug, 0.5, 0.99))).toBe(MAT.stone);
    // The rim is darker than the stone around it.
    const rim = sample(dug).filter(
      (t) => t !== CLEAR && levelOf(t) < 0.35 && matOf(t) === MAT.stone,
    );
    expect(rim.length).toBeGreaterThan(0);
  });
});

describe('pixel floor textures', () => {
  it('lays flagstones in offset rows', () => {
    expect(mats(sample(flag))).toEqual(new Set<Mat>([MAT.flag, MAT.mortar]));
    expect(matOf(at(flag, 0.5, 0.5 / TEXELS))).toBe(MAT.mortar);
  });

  it('puts a beam over each cell and slabs between', () => {
    expect(mats(sample(ceiling))).toEqual(new Set<Mat>([MAT.wood, MAT.ceiling, MAT.mortar]));
    expect(matOf(at(ceiling, 0.5, 0.05))).toBe(MAT.wood);
    expect(matOf(at(ceiling, 0.4, 0.6))).toBe(MAT.ceiling);
    // The beam's underside is lit, its far edge dark.
    expect(levelOf(at(ceiling, 0.5, 15.5 / TEXELS))).toBeGreaterThan(
      levelOf(at(ceiling, 0.5, 0.5 / TEXELS)),
    );
  });

  it('sinks stairs into the dark away from the party, nosings lit', () => {
    for (const up of [true, false]) {
      const s: Tex = (u, v, seed) => stairs(u, v, seed, up);
      expect(levelOf(at(s, 0.5, 0.95))).toBeGreaterThan(levelOf(at(s, 0.5, 0.05)));
      expect(levelOf(at(s, 0.02, 0.5))).toBeLessThan(0.2);
    }
    // Going down, a tread's near edge is its nosing; going up, its far edge.
    const down: Tex = (u, v, seed) => stairs(u, v, seed, false);
    const up: Tex = (u, v, seed) => stairs(u, v, seed, true);
    const tread = 4 / 6;
    expect(levelOf(at(down, 0.5, tread + 0.01))).toBeGreaterThan(
      levelOf(at(down, 0.5, tread + 0.1)),
    );
    expect(levelOf(at(up, 0.5, tread + 0.16))).toBeGreaterThan(levelOf(at(up, 0.5, tread + 0.1)));
  });

  it('sets a riveted iron plate, lit on two edges', () => {
    expect(mats(sample(plate))).toEqual(new Set<Mat>([MAT.iron]));
    expect(levelOf(at(plate, 0.02, 0.3))).toBeGreaterThan(levelOf(at(plate, 0.98, 0.3)));
    expect(levelOf(at(plate, 0.125, 0.125))).toBeGreaterThan(levelOf(at(plate, 0.25, 0.25)) - 0.1);
  });
});
