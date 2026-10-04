/** Four uint32 words of xoshiro128** state; store this in save files. */
export type RngState = readonly [number, number, number, number];

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** A snapshot that rngFromState turns back into an identical stream. */
  state(): RngState;
}

const UINT32 = 0x1_0000_0000;

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

// FNV-1a, so named streams ("xp-sim", "loot") get distinct, stable seeds.
function hashSeed(seed: number | string): number {
  if (typeof seed === 'number') {
    if (!Number.isSafeInteger(seed)) throw new Error(`seed must be an integer, got ${seed}`);
    return seed >>> 0;
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// splitmix32 expands one seed word into the four state words xoshiro needs.
function expandSeed(seed: number): [number, number, number, number] {
  let x = seed >>> 0;
  const next = () => {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  return [next(), next(), next(), next()];
}

export function rngFromState(initial: RngState): Rng {
  // Validate before coercing, so a corrupt save can't silently become a stream of zeros.
  if (initial.length !== 4 || !initial.every((w) => Number.isInteger(w) && w >= 0 && w < UINT32)) {
    throw new Error('RNG state must be four 32-bit unsigned integers');
  }
  if (initial.every((w) => w === 0)) throw new Error('RNG state cannot be all zeros');
  const s = [...initial] as [number, number, number, number];

  // xoshiro128** (Blackman and Vigna).
  const nextUint32 = (): number => {
    const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] = (s[2] ^ s[0]) >>> 0;
    s[3] = (s[3] ^ s[1]) >>> 0;
    s[1] = (s[1] ^ s[2]) >>> 0;
    s[0] = (s[0] ^ s[3]) >>> 0;
    s[2] = (s[2] ^ t) >>> 0;
    s[3] = rotl(s[3], 11);
    return result;
  };

  return {
    next: () => nextUint32() / UINT32,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new Error(`invalid range [${min}, ${max}]`);
      }
      const range = max - min + 1;
      if (range > UINT32) throw new Error(`range [${min}, ${max}] exceeds 2^32 values`);
      // Rejection sampling removes modulo bias.
      const limit = UINT32 - (UINT32 % range);
      let x = nextUint32();
      while (x >= limit) x = nextUint32();
      return min + (x % range);
    },
    state: () => [s[0], s[1], s[2], s[3]],
  };
}

export function createRng(seed: number | string): Rng {
  return rngFromState(expandSeed(hashSeed(seed)));
}
