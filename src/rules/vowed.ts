// The Vowed's numbers (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.17 The Vowed.md).

/** Unarmored Defense: 13 plus half the character level, rounded down. */
export const unarmoredAc = (level: number): number => 13 + Math.floor(level / 2);

/** Unarmed Might's table stops at 10th level; past it the punch stays at the 10th-level row. */
export const punchRow = (level: number): number => Math.min(Math.max(level, 1), 10);
