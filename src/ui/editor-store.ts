// Browser storage for the editors' saved dungeons and overland maps. Storage can be missing or
// blocked, so every access is guarded and the editors keep working, unsaved, without it.
import { libraryText, parseLibrary, type LoadedLibrary } from '../game/editor/library.ts';
import type { EditorLibrary } from '../data/schemas/index.ts';

const KEY = 'wastes-crawler.editor';

export function loadLibrary(): LoadedLibrary {
  let text: string | null;
  try {
    text = localStorage.getItem(KEY);
  } catch {
    return {
      library: { dungeons: [], regions: [] },
      errors: ['browser storage is unavailable, so editor work won’t be saved'],
    };
  }
  const loaded = parseLibrary(text);
  if (loaded.errors.length === 0 || text === null) return loaded;
  // Work that no longer loads is kept aside, so saving over it loses nothing. A full storage can
  // refuse the copy; the work that did load is still returned, with a warning.
  try {
    let n = 1;
    for (let old; (old = localStorage.getItem(`${KEY}.unreadable.${n}`)) !== null; n++)
      if (old === text) return loaded;
    localStorage.setItem(`${KEY}.unreadable.${n}`, text);
    return loaded;
  } catch {
    return {
      ...loaded,
      errors: [
        ...loaded.errors,
        'browser storage is full, so the unreadable work couldn’t be set aside: export your work before saving',
      ],
    };
  }
}

/** False when storage is unavailable or full. */
export function saveLibrary(lib: EditorLibrary): boolean {
  try {
    localStorage.setItem(KEY, libraryText(lib));
    return true;
  } catch {
    return false;
  }
}

/** Offers text as a file download. */
export function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
