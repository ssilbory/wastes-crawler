// Saved work in the game (Sam's call): the game screen reloads the editors' saved dungeons each
// time it opens, and a world on a custom map brings its map and the dungeons saved on it.
import type { Region } from '../data/schemas/index.ts';
import { playableContent, type Playable } from '../game/editor/playable.ts';
import { data, shippedContent } from './builder/data.ts';
import { loadLibrary } from './editor-store.ts';

/**
 * Puts the playable saved dungeons, and a world's custom map with its dungeons, into the game's
 * content, and says which dungeons were left out.
 */
export function loadPlayable(map: Region | null = null): Playable {
  const playable = playableContent(data.srd, shippedContent, loadLibrary().library, map);
  data.content = playable.content;
  return playable;
}
