import { allMonsters } from '../../data/monsters.ts';
import type { ContentData, Monster, Progression, SrdData } from '../../data/schemas/index.ts';

/** Everything character rules need to look up; built once from loadSrd() and loadContent(). */
export interface GameData {
  srd: SrdData;
  content: ContentData;
}

export function findProgression(data: GameData, id: string): Progression | undefined {
  return data.srd.progressions.find((p) => p.id === id);
}

export function progressionLookup(data: GameData): (id: string) => Progression {
  return (id) => {
    const p = findProgression(data, id);
    if (!p) throw new Error(`unknown class ${id}`);
    return p;
  };
}

export function isSkill(data: GameData, id: string): boolean {
  return data.srd.skills.some((s) => s.id === id);
}

/** A monster by id, SRD or authored. */
export function findMonster(data: GameData, id: string): Monster | undefined {
  return allMonsters(data.srd, data.content).find((m) => m.id === id);
}
