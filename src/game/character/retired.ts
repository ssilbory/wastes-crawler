// Skills and foci the game has taken away (docs/rules-adaptation.md, Skills): a removed skill
// becomes its replacement, keeping the higher level, with the points saved toward each added
// together; and each level of a focus no longer offered becomes a free focus pick.
import type { Character } from '../../data/schemas/index.ts';
import type { GameData } from './context.ts';

function merged(
  record: Record<string, number>,
  from: string,
  to: string,
  combine: (a: number, b: number) => number,
): Record<string, number> {
  const value = record[from];
  if (value === undefined) return record;
  const rest = Object.fromEntries(Object.entries(record).filter(([id]) => id !== from));
  const already = rest[to];
  return { ...rest, [to]: already === undefined ? value : combine(value, already) };
}

export function retire(data: GameData, c: Character): Character {
  let skills = c.skills;
  let credit = c.advancement.skillCredit;
  for (const r of data.content.skillRules.removed) {
    skills = merged(skills, r.id, r.becomes, Math.max);
    // Points spent toward either skill were spent toward the one it is now.
    credit = merged(credit, r.id, r.becomes, (a, b) => a + b);
  }
  const gone = (id: string) => data.content.skillRules.retiredFoci.includes(id);
  const owed = c.foci.filter((f) => gone(f.id)).reduce((sum, f) => sum + f.level, 0);
  const freeFoci = (c.advancement.freeFoci ?? 0) + owed;
  return {
    ...c,
    skills,
    foci: c.foci.filter((f) => !gone(f.id)),
    advancement: {
      ...c.advancement,
      skillCredit: credit,
      ...(freeFoci > 0 ? { freeFoci } : {}),
    },
  };
}
