// Saved dungeons in the game (Sam's call): the game screen reloads the editors' saved work each
// time it opens, so what was saved in the level editor is there to play.
import { playableContent, type Playable } from '../game/editor/playable.ts';
import { data, shippedContent } from './builder/data.ts';
import { loadLibrary } from './editor-store.ts';

/** Puts the playable saved dungeons into the game's content, and says which were left out. */
export function loadPlayable(): Playable {
  const playable = playableContent(data.srd, shippedContent, loadLibrary().library);
  data.content = playable.content;
  return playable;
}
