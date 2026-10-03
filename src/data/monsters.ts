import type { ContentData, Monster, SrdData } from './schemas/index.ts';

/** Every monster the game knows: the SRD's, then those authored for the setting. */
export function allMonsters(srd: SrdData, content: ContentData): Monster[] {
  return [...srd.monsters, ...content.monsters];
}
