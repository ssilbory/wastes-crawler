// What a raising leaves on a character (docs/rules-adaptation.md, Raised by a necromancer or a
// priest in Phase 20): the Half-Dead focus's effects, read from its entry in
// data/content/racial-foci.json.
import type { Character } from '../../data/schemas/index.ts';
import type { GameData } from './context.ts';
import { activeEffects } from './equipment.ts';

export interface RaisedMarks {
  /** Never Hungry, Sleepless, or Cold. */
  privationProof: boolean;
  /** Healing Touch does nothing for them. */
  touchless: boolean;
  /** Added to saves against poison and disease. */
  ailmentSave: number;
  /** Immune to poison and disease. */
  ailmentImmune: boolean;
}

export function raisedMarks(data: GameData, c: Character): RaisedMarks {
  const effects = activeEffects(data, c.foci);
  const has = (kind: string) => effects.some((e) => e.kind === kind);
  return {
    privationProof: has('no-privation'),
    touchless: has('no-healing-touch'),
    ailmentSave: effects.reduce((sum, e) => sum + (e.kind === 'ailment-save' ? e.amount : 0), 0),
    ailmentImmune: has('ailment-immune'),
  };
}
