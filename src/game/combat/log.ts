// The battle log, kept apart so every combat module can write to it without import cycles.
import type { Battle } from './types.ts';

export function say(b: Battle, text: string): void {
  b.log?.push(`Round ${b.round}: ${text}`);
  // Whose turn the line came in, for the log's filters (docs/presentation-plan.md, V3).
  b.logSides?.push(b.acting);
}
