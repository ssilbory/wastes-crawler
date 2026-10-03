import {
  CHARACTER_SCHEMA_VERSION,
  CharacterSchema,
  type Character,
} from '../../data/schemas/index.ts';
import { findProgression, isSkill, type GameData } from './context.ts';
import { findLineage, findPeople } from './people.ts';

export type Raw = Record<string, unknown>;
export type Migrations = Readonly<Record<number, (raw: Raw) => Raw>>;

/** Upgrades a save from version n to n + 1, keyed by n. Empty until the schema first changes. */
const MIGRATIONS: Migrations = {};

export function exportCharacter(c: Character): string {
  return `${JSON.stringify(c, null, 2)}\n`;
}

export type ImportResult = { ok: true; character: Character } | { ok: false; errors: string[] };

/**
 * Parses, migrates, and validates a character file. Hand-edited values are accepted as long as they
 * fit the schema and reference real data; editing your own characters is allowed.
 */
export function importCharacter(
  text: string,
  data: GameData,
  migrations: Migrations = MIGRATIONS,
): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`not valid JSON: ${(e as Error).message}`] };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['not a character file'] };
  }
  let doc = raw as Raw;
  let version = doc.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { ok: false, errors: ['schemaVersion is missing'] };
  }
  if (version > CHARACTER_SCHEMA_VERSION) {
    return { ok: false, errors: [`made by a newer version of the game (schema ${version})`] };
  }
  for (; version < CHARACTER_SCHEMA_VERSION; version++) {
    const migrate = migrations[version];
    if (!migrate) return { ok: false, errors: [`no upgrade from schema ${version}`] };
    doc = migrate(doc);
  }

  const parsed = CharacterSchema.safeParse(doc);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(file)'}: ${i.message}`),
    };
  }
  const c = parsed.data;
  const errors: string[] = [];
  const people = findPeople(data, c.people);
  if (!people) errors.push(`people: unknown ${c.people}`);
  else if (people.lineages && c.lineage === undefined) {
    errors.push(`lineage: ${people.name} characters need one`);
  } else if (c.lineage !== undefined && !findLineage(people, c.lineage)) {
    errors.push(`lineage: unknown ${people.name} lineage ${c.lineage}`);
  }
  if (!data.content.backgrounds.some((b) => b.id === c.background)) {
    errors.push(`background: unknown ${c.background}`);
  }
  for (const skill of Object.keys(c.skills)) {
    if (!isSkill(data, skill)) errors.push(`skills: unknown ${skill}`);
  }
  for (const id of Object.keys(c.classes.levels)) {
    if (!findProgression(data, id)) errors.push(`classes: unknown ${id}`);
  }
  if (!Object.hasOwn(c.classes.levels, c.classes.current)) {
    errors.push(`classes.current: ${c.classes.current} has no level entry`);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, character: c };
}
