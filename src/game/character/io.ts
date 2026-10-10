import {
  CHARACTER_SCHEMA_VERSION,
  SavedCharacterSchema,
  type Character,
} from '../../data/schemas/index.ts';
import { classOption } from './class-step.ts';
import { findProgression, isSkill, type GameData } from './context.ts';
import { focusInfo } from './foci.ts';
import { formProblem } from './forms.ts';
import { findItem } from './items.ts';
import { findLineage, findPeople } from './people.ts';
import { retire } from './retired.ts';
import { gameSpells } from '../../data/spells.ts';

export type Raw = Record<string, unknown>;
export type Migrations = Readonly<Record<number, (raw: Raw) => Raw>>;

/** Upgrades a save from version n to n + 1, keyed by n. */
export const MIGRATIONS: Migrations = {
  // Version 2 adds foci (Phase 3c); older characters were made before foci could be chosen.
  1: (raw) => ({ ...raw, foci: [], schemaVersion: 2 }),
  // Version 3 adds gear (Phase 3d); older characters start with nothing.
  2: (raw) => ({ ...raw, inventory: [], crowns: 0, schemaVersion: 3 }),
  // Version 4 adds arts and spells (Phase 3e); older characters had no Mage classes.
  3: (raw) => ({ ...raw, arts: [], spells: { known: [], prepared: [] }, schemaVersion: 4 }),
  // Version 5 adds leveling in town (Phase 6a): attribute boosts and saved skill points.
  4: (raw) => ({
    ...raw,
    attributes: { ...(raw.attributes as Raw), advancement: {} },
    advancement: { skillPoints: 0, quickPoints: 0, skillCredit: {} },
    schemaVersion: 5,
  }),
  // Version 6 gives beastmen a source animal (Phase 12b); older beastmen were herd stock.
  5: (raw) => ({
    ...raw,
    ...(raw.people === 'beastman' && raw.lineage === undefined ? { lineage: 'herd' } : {}),
    schemaVersion: 6,
  }),
  // Version 7 retires skills and the Rider focus (docs/rules-adaptation.md, Skills). The swap needs
  // the content, so importCharacter makes it for files from before this version.
  6: (raw) => ({ ...raw, schemaVersion: 7 }),
};

/** The first version made after the skills and Rider were retired. */
const RETIRED_IN = 7;

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
  const from = version;
  for (; version < CHARACTER_SCHEMA_VERSION; version++) {
    const migrate = migrations[version];
    if (!migrate) return { ok: false, errors: [`no upgrade from schema ${version}`] };
    doc = migrate(doc);
  }

  const parsed = SavedCharacterSchema.safeParse(doc);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(file)'}: ${i.message}`),
    };
  }
  const c = from < RETIRED_IN ? retire(data, parsed.data) : parsed.data;
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
  for (const item of c.inventory) {
    if (!findItem(data, item.id)) errors.push(`inventory: unknown ${item.id}`);
  }
  for (const id of c.arts) {
    if (!data.srd.arts.some((a) => a.id === id)) errors.push(`arts: unknown ${id}`);
  }
  for (const id of [...c.spells.known, ...c.spells.prepared]) {
    if (!gameSpells(data.srd, data.content).some((sp) => sp.id === id))
      errors.push(`spells: unknown ${id}`);
  }
  for (const f of c.foci) {
    if (!focusInfo(data, f.id)) errors.push(`foci: unknown ${f.id}`);
  }
  for (const id of Object.keys(c.classes.levels)) {
    if (!classOption(data, id) || !findProgression(data, id)) errors.push(`classes: unknown ${id}`);
  }
  const forms = formProblem(data, c, c.forms ?? []);
  if (forms) errors.push(`forms: ${forms}`);
  if (!Object.hasOwn(c.classes.levels, c.classes.current)) {
    errors.push(`classes.current: ${c.classes.current} has no level entry`);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, character: c };
}
