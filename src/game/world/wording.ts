// Small bits of wording shared by the game layer's log lines.

export const daysText = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

const SHARES: Record<number, string> = {
  0.25: 'a quarter share',
  0.5: 'a half share',
  0.75: 'a three-quarter share',
  1: 'a full share',
};

/** A hireling's share of the loot, in words. */
export const shareText = (share: number) => SHARES[share] ?? `a ${share} share`;
