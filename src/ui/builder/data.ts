import { loadContent } from '../../data/content.ts';
import { loadSrd } from '../../data/load.ts';
import type { Attribute, GrowthEntry, LearningEntry } from '../../data/schemas/index.ts';
import type { GameData } from '../../game/character/context.ts';
import { createRng, type Rng } from '../../rules/rng.ts';

export const data: GameData = { srd: loadSrd(), content: loadContent() };

export const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

export const skills = data.srd.skills.map((s) => ({ id: s.id, name: s.name }));

export function skillName(id: string): string {
  return skills.find((s) => s.id === id)?.name ?? id;
}

export const classes = data.content.classOptions.map((c) => ({ id: c.id, name: c.name }));

export function className(id: string): string {
  return (
    data.content.classOptions.find((c) => c.id === id)?.name ??
    data.srd.progressions.find((p) => p.id === id)?.name ??
    id
  );
}

export function entryLabel(entry: GrowthEntry | LearningEntry): string {
  switch (entry.kind) {
    case 'skill':
      return skillName(entry.skill);
    case 'any-combat':
      return 'Any Combat';
    case 'any-skill':
      return 'Any Skill';
    case 'attribute': {
      const pool = { any: 'Any Stat', physical: 'Physical', mental: 'Mental' }[entry.pool];
      return `+${entry.amount} ${pool}`;
    }
  }
}

export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** The UI's one source of entropy: a seed for the injected game RNG. */
export function freshRng(): Rng {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  return createRng(`${words[0]}-${words[1]}`);
}
