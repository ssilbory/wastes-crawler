// How hurt a health bar shows: steps of colour, so danger reads before the bar is empty.

export type HpLevel = 'fine' | 'hurt' | 'low';

/** `percent` of hit points left: half or less is hurt, a quarter or less is low. */
export function hpLevel(percent: number): HpLevel {
  if (percent <= 25) return 'low';
  if (percent <= 50) return 'hurt';
  return 'fine';
}
