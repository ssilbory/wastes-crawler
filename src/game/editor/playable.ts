// Saved dungeons in the game (Sam's call): the game plays the shipped content plus each saved
// dungeon that stands on a shipped map and passes every content check, so a broken one can't break
// a campaign. Saved maps stay in the editor until the game can start on them.
import { contentReferenceErrors } from '../../data/content.ts';
import type { ContentData, EditorLibrary, SrdData } from '../../data/schemas/index.ts';

export interface Playable {
  content: ContentData;
  /** Saved dungeons left out, by id, with the first reason. */
  skipped: Record<string, string>;
}

/** The content the game plays, saved dungeons taken one at a time in the order they were saved. */
export function playableContent(srd: SrdData, shipped: ContentData, lib: EditorLibrary): Playable {
  const known = new Set(contentReferenceErrors(srd, shipped));
  const skipped: Record<string, string> = {};
  let content = shipped;
  for (const d of lib.dungeons) {
    if (!shipped.regions.some((r) => r.id === d.region)) {
      skipped[d.id] = 'it is on a map the game can’t play yet';
      continue;
    }
    const dungeons = content.dungeons.some((x) => x.id === d.id)
      ? content.dungeons.map((x) => (x.id === d.id ? d : x))
      : [...content.dungeons, d];
    const next = { ...content, dungeons };
    const problem = contentReferenceErrors(srd, next).find((e) => !known.has(e));
    if (problem === undefined) content = next;
    else skipped[d.id] = problem;
  }
  return { content, skipped };
}
