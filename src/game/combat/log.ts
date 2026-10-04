// The battle log, kept apart so every combat module can write to it without import cycles.
import type { Battle } from './types.ts';

export function say(b: Battle, text: string): void {
  b.log?.push(`Round ${b.round}: ${text}`);
}
