// vendor/wwn-srd/2.0 The Rules of the Game/2.2.0 Saving Throws.md
// plus the 2+ floor in docs/decisions/0001-high-level-progression.md.
import type { Attribute } from '../data/schemas/index.ts';
import { rollD20WithEdge, type D20Roll } from './advantage.ts';
import { bestModifier, type AttributeScores } from './attributes.ts';
import type { Rng } from './rng.ts';

export type SaveType = 'physical' | 'evasion' | 'mental' | 'luck';

export const SAVE_FLOOR = 2;

const SAVE_ATTRIBUTES: Record<SaveType, readonly Attribute[]> = {
  physical: ['str', 'con'],
  evasion: ['dex', 'int'],
  mental: ['wis', 'cha'],
  luck: [],
};

export function pcSaveTarget(level: number, scores: AttributeScores, type: SaveType): number {
  const attrs = SAVE_ATTRIBUTES[type];
  const mod = attrs.length > 0 ? bestModifier(scores, attrs) : 0;
  return Math.max(SAVE_FLOOR, 16 - level - mod);
}

/** For NPCs without a stat line; monsters use the save listed in their stat line. */
export function npcSaveTarget(hitDice: number): number {
  return Math.max(SAVE_FLOOR, 15 - Math.floor(hitDice / 2));
}

export interface SaveResult extends D20Roll {
  score: number;
  success: boolean;
}

/** A natural 1 always fails and a natural 20 always succeeds, whatever the modifiers. */
export function rollSave(
  rng: Rng,
  target: number,
  options: { modifier?: number; steps?: number } = {},
): SaveResult {
  const d = rollD20WithEdge(rng, options.steps ?? 0);
  const score = d.total + (options.modifier ?? 0);
  const success = d.natural === 20 || (d.natural !== 1 && score >= target);
  return { ...d, score, success };
}
