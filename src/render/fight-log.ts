// The battle log as the fight screen lists it (docs/presentation-plan.md, V3): every line, or only
// those that came in on one side's turns. Lines from between turns (the end of a round, a death
// from wounds) and any added after the fight show only under All. Read-only.
import type { SideId } from '../game/combat/types.ts';

export type LogFilter = 'all' | SideId;

export interface LogLine {
  text: string;
  /** Its place in the whole log, to tell new lines from old. */
  index: number;
}

export function logLines(
  lines: readonly string[],
  sides: readonly (SideId | null)[] | null,
  filter: LogFilter,
): LogLine[] {
  const all = lines.map((text, index) => ({ text, index }));
  return filter === 'all' ? all : all.filter((l) => sides?.[l.index] === filter);
}
