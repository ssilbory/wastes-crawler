// Skills and foci the game has taken away (docs/rules-adaptation.md, Skills): a removed skill
// becomes its replacement, keeping the higher level, and each level of a focus no longer offered
// becomes a free focus pick.
import type { Character } from '../../data/schemas/index.ts';
import type { GameData } from './context.ts';

function merged(record: Record<string, number>, from: string, to: string): Record<string, number> {
  const level = record[from];
  if (level === undefined) return record;
  const rest = Object.fromEntries(Object.entries(record).filter(([id]) => id !== from));
  return { ...rest, [to]: Math.max(level, rest[to] ?? level) };
}

export function retire(data: GameData, c: Character): Character {
  let skills = c.skills;
  let credit = c.advancement.skillCredit;
  for (const r of data.content.skillRules.removed) {
    skills = merged(skills, r.id, r.becomes);
    credit = merged(credit, r.id, r.becomes);
  }
  const gone = (id: string) =>
    data.content.focusRules.find((f) => f.id === id)?.availability === 'excluded';
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
