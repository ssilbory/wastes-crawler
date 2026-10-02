import type { Rng } from '../../src/rules/rng.ts';

/** An Rng that returns the given die faces in order, so tests can force exact outcomes. */
export function scriptedRng(faces: number[]): Rng & { remaining(): number } {
  const queue = [...faces];
  return {
    next() {
      throw new Error('scriptedRng only supports int()');
    },
    int(min, max) {
      const face = queue.shift();
      if (face === undefined) throw new Error('scriptedRng ran out of faces');
      if (face < min || face > max) throw new Error(`face ${face} outside [${min}, ${max}]`);
      return face;
    },
    state() {
      throw new Error('scriptedRng has no state');
    },
    remaining: () => queue.length,
  };
}
