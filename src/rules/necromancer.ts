// The Necromancer's numbers (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.14 The
// Necromancer.md).

/** Cold Flesh: a natural AC of 12 plus half the level, rounded down. */
export const coldFleshAc = (level: number): number => 12 + Math.floor(level / 2);
