// vendor/wwn-srd/2.0 The Rules of the Game/2.12.0 Wilderness Exploration and Expeditions.md
// (2.12.6): what a wandering encounter is fits the logic of the place. In the Wastes that logic is
// its warlords (docs/rules-adaptation.md, The Wastes: Warbands and A warlord falls): a fallen
// warlord's warband is gone, and the hostile groups left on their map come half as often.

export interface WeightedEntry {
  weight: number;
  nature: 'hostile' | 'wary';
  warband?: string | undefined;
}

/**
 * Each entry's weight on the roll: 0 for a fallen warlord's warband; on a table a fallen warlord
 * ruled (`thinned`), hostile entries keep `hostilePercent` of their weight, rounded up.
 */
export function encounterWeights(
  entries: readonly WeightedEntry[],
  fallen: ReadonlySet<string>,
  thinned: boolean,
  hostilePercent: number,
): number[] {
  return entries.map((e) => {
    if (e.warband && fallen.has(e.warband)) return 0;
    if (thinned && e.nature === 'hostile') return Math.ceil((e.weight * hostilePercent) / 100);
    return e.weight;
  });
}
