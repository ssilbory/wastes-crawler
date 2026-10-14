// Saved dungeons in the game (Sam's call): the game plays the shipped content plus each saved
// dungeon that stands on a shipped map and passes every content check, so a broken one can't break
// a campaign. A saved map plays as a world of its own, without the campaign's story.
import { contentReferenceErrors, withShippedWorld } from '../../data/content.ts';
import type { ContentData, EditorLibrary, Region, SrdData } from '../../data/schemas/index.ts';
import { withWorldMap } from '../world/region.ts';
import { mapErrors } from './map-edit.ts';

export interface Playable {
  content: ContentData;
  /** Saved dungeons left out, by id, with the first reason. */
  skipped: Record<string, string>;
}

/**
 * The content the game plays, saved dungeons taken one at a time in the order they were saved.
 * With `map`, the custom map a world is played on (Sam's call), its saved dungeons play too, and
 * for a shipped world its own dungeons.
 */
export function playableContent(
  srd: SrdData,
  shipped: ContentData,
  lib: EditorLibrary,
  map: Region | null = null,
): Playable {
  // A shipped world brings its own dungeons; a map saved in the editor only those saved on it.
  const world = map && shipped.worlds.find((x) => x.map.id === map.id);
  const base = world
    ? withShippedWorld(shipped, world)
    : withWorldMap({ srd, content: shipped }, map).content;
  const known = new Set(contentReferenceErrors(srd, base));
  const skipped: Record<string, string> = {};
  let content = base;
  for (const d of lib.dungeons) {
    if (!base.regions.some((r) => r.id === d.region)) {
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

/**
 * Why a saved map can't be a world, or nothing: the overland checks, and town ids already used on
 * another map, since town services and saves know towns by id.
 */
export function worldMapErrors(srd: SrdData, shipped: ContentData, map: Region): string[] {
  const elsewhere = new Set(
    [...shipped.regions, ...shipped.worlds.map((w) => w.map)]
      .filter((r) => r.id !== map.id)
      .flatMap((r) => r.sites.map((s) => s.id)),
  );
  return [
    ...mapErrors(srd, shipped, map, []),
    ...map.sites
      .filter((s) => elsewhere.has(s.id))
      .map((s) => `regions/${map.id}/${s.id}: another map has a town with this id`),
  ];
}
