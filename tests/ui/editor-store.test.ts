import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLibrary } from '../../src/ui/editor-store.ts';
import { data } from '../game/world/helpers.ts';

const KEY = 'wastes-crawler.editor';

/** A browser storage holding `items`, whose writes fail when `full`. */
function storage(items: Record<string, string>, full = false) {
  const map = new Map(Object.entries(items));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (full) throw new DOMException('full', 'QuotaExceededError');
      map.set(k, v);
    },
    map,
  };
}

// One dungeon that loads and one that no longer does.
const saved = JSON.stringify({
  version: 1,
  dungeons: [data.content.dungeons[0], { id: 'broken' }],
  regions: [],
});

describe('loading the editors’ saved work', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets unreadable work aside and keeps what loads', () => {
    const store = storage({ [KEY]: saved });
    vi.stubGlobal('localStorage', store);
    const loaded = loadLibrary();
    expect(loaded.library.dungeons).toHaveLength(1);
    expect(store.map.get(`${KEY}.unreadable.1`)).toBe(saved);
  });

  it('still returns the work that loads when storage is too full for the copy', () => {
    vi.stubGlobal('localStorage', storage({ [KEY]: saved }, true));
    const loaded = loadLibrary();
    expect(loaded.library.dungeons).toHaveLength(1);
    expect(loaded.errors.at(-1)).toContain('browser storage is full');
  });

  it('works unsaved when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    expect(loadLibrary()).toMatchObject({ library: { dungeons: [] } });
  });
});
