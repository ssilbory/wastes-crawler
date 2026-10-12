// The editors' saved dungeons and overland maps (Sam's call: saved in the browser, alongside the
// shipped content). A saved record with a shipped record's id stands in for it in the editors.
import {
  DungeonSchema,
  EditorLibraryFileSchema,
  RegionSchema,
  type ContentData,
  type Dungeon,
  type EditorLibrary,
  type Region,
} from '../../data/schemas/index.ts';

export const EMPTY_LIBRARY: EditorLibrary = { dungeons: [], regions: [] };

export interface LoadedLibrary {
  library: EditorLibrary;
  errors: string[];
}

/** The stored library; records that no longer load are dropped and named. */
export function parseLibrary(text: string | null): LoadedLibrary {
  if (text === null) return { library: EMPTY_LIBRARY, errors: [] };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { library: EMPTY_LIBRARY, errors: ['the saved editor work is not readable JSON'] };
  }
  const file = EditorLibraryFileSchema.safeParse(json);
  if (!file.success)
    return { library: EMPTY_LIBRARY, errors: ['the saved editor work is not in a known format'] };
  const errors: string[] = [];
  const keep = <T>(list: unknown[], parse: (v: unknown) => T | undefined, kind: string) =>
    list.flatMap((raw, i) => {
      const parsed = parse(raw);
      if (parsed !== undefined) return [parsed];
      const id = (raw as { id?: unknown } | null)?.id;
      errors.push(`saved ${kind} ${typeof id === 'string' ? id : `#${i + 1}`} no longer loads`);
      return [];
    });
  return {
    library: {
      dungeons: keep(file.data.dungeons, (v) => DungeonSchema.safeParse(v).data, 'dungeon'),
      regions: keep(file.data.regions, (v) => RegionSchema.safeParse(v).data, 'map'),
    },
    errors,
  };
}

export const libraryText = (lib: EditorLibrary) =>
  JSON.stringify({ version: 1, dungeons: lib.dungeons, regions: lib.regions });

const upsert = <T extends { id: string }>(list: readonly T[], item: T) =>
  list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item];

export const saveDungeon = (lib: EditorLibrary, d: Dungeon): EditorLibrary => ({
  ...lib,
  dungeons: upsert(lib.dungeons, d),
});

export const saveRegion = (lib: EditorLibrary, r: Region): EditorLibrary => ({
  ...lib,
  regions: upsert(lib.regions, r),
});

export const deleteDungeon = (lib: EditorLibrary, id: string): EditorLibrary => ({
  ...lib,
  dungeons: lib.dungeons.filter((d) => d.id !== id),
});

/** Drops a saved map; its saved dungeons stay, to be placed on another map. */
export const deleteRegion = (lib: EditorLibrary, id: string): EditorLibrary => ({
  ...lib,
  regions: lib.regions.filter((r) => r.id !== id),
});

const merge = <T extends { id: string }>(shipped: readonly T[], saved: readonly T[]) => [
  ...shipped.map((x) => saved.find((s) => s.id === x.id) ?? x),
  ...saved.filter((s) => !shipped.some((x) => x.id === s.id)),
];

/** The content with the saved dungeons and maps in place of, or beside, the shipped ones. */
export function withLibrary(content: ContentData, lib: EditorLibrary): ContentData {
  return {
    ...content,
    dungeons: merge(content.dungeons, lib.dungeons),
    regions: merge(content.regions, lib.regions),
  };
}

/** A content id from a name: lower case words joined by dashes. */
export function slug(name: string, fallback: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s === '' ? fallback : s;
}

/** The base id, or the base with the lowest number after it that isn't taken. */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Dungeons from a file: one dungeon, or a list like dungeons.json; the ones that don't load are named. */
export function importDungeons(text: string): { dungeons: Dungeon[]; errors: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { dungeons: [], errors: ['the file is not readable JSON'] };
  }
  const list = Array.isArray(json) ? json : [json];
  const dungeons: Dungeon[] = [];
  const errors: string[] = [];
  list.forEach((raw, i) => {
    const parsed = DungeonSchema.safeParse(raw);
    if (parsed.success) dungeons.push(parsed.data);
    else
      errors.push(
        `dungeon #${i + 1} is not a dungeon: ${parsed.error.issues.map((x) => x.message).join('; ')}`,
      );
  });
  return { dungeons, errors };
}
