import type { Character } from '../../data/schemas/index.ts';
import { exportCharacter } from '../../game/character/io.ts';

/** Saves a character's JSON file through the browser. */
export function download(character: Character): void {
  const blob = new Blob([exportCharacter(character)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${character.name.replace(/[^\w-]+/g, '_') || 'character'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
