import { gameSpells } from '../../data/spells.ts';
import type { Battle } from './types.ts';

/** A spell's level, for what casting it costs. */
export const spellLevel = (b: Battle, id: string): number =>
  gameSpells(b.data.srd, b.data.content).find((s) => s.id === id)?.level ?? 1;
