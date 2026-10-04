import type {
  CastingProgression,
  ClassRecord,
  Progression,
  Source,
} from '../../../src/data/schemas/index.ts';
import {
  childHeadings,
  findHeading,
  parseTables,
  proseText,
  sectionLines,
  slug,
  type MdDoc,
  type Table,
} from '../markdown.ts';
import { parseDice, parseInt10, parseSigned } from '../parse-values.ts';
import type { SrdReader } from '../reader.ts';

const CLASS_DIR = '1.0 Character Creation/1.5.0 Class List';

/** The base classes, the Mage umbrella, and three Mage traditions (the Necromancer in Phase 14b). */
export const CLASS_FILES = [
  '1.5.1 The Adventurer.md',
  '1.5.8 The Expert.md',
  '1.5.18 The Warrior.md',
  '1.5.12 The Mage.md',
  '1.5.10 The High Mage.md',
  '1.5.7 The Elementalist.md',
  '1.5.14 The Necromancer.md',
].map((f) => `${CLASS_DIR}/${f}`);

export interface ClassExtract {
  classes: ClassRecord[];
  progressions: Progression[];
  casting: CastingProgression[];
}

/** "Partial Expert/Partial Warrior" and "Partial Warrior/Partial Expert" are the same table. */
function progressionId(heading: string): string {
  return heading
    .split('/')
    .map((part) => slug(part))
    .sort()
    .join('-');
}

function col(table: Table, name: RegExp, where: string): number {
  const i = table.header.findIndex((h) => name.test(h));
  if (i < 0) throw new Error(`${where}: no column matching ${String(name)}`);
  return i;
}

const PICK_ORDER = ['warrior', 'expert', 'any'] as const;

/** Merged by category in a fixed order, since SRD copies of a table list picks in different orders. */
export function parseFocusPicks(
  cell: string,
  where: string,
): Progression['levels'][number]['focusPicks'] {
  const counts = new Map<(typeof PICK_ORDER)[number], number>();
  for (const t of cell.split(/<br\s*\/?>/i).map((x) => x.trim())) {
    if (t === '') continue;
    const m = /^\+?(\d+)\s+(Any|Warrior|Expert)$/.exec(t);
    if (!m?.[1] || !m[2]) throw new Error(`${where}: bad focus pick "${t}"`);
    const category = m[2].toLowerCase() as (typeof PICK_ORDER)[number];
    counts.set(category, (counts.get(category) ?? 0) + Number(m[1]));
  }
  return PICK_ORDER.filter((c) => counts.has(c)).map((category) => ({
    count: counts.get(category) ?? 0,
    category,
  }));
}

function progressionLevels(table: Table, where: string): Progression['levels'] {
  const [lv, hd, ab, fp] = [/^Level$/, /^Hit Dice$/, /Attack/, /^Focus Picks$/].map((r) =>
    col(table, r, where),
  ) as [number, number, number, number];
  return table.rows.map((r) => ({
    level: parseInt10(r[lv] ?? ''),
    hitDice: parseDice(r[hd] ?? ''),
    attackBonus: parseSigned(r[ab] ?? ''),
    focusPicks: parseFocusPicks(r[fp] ?? '', `${where} level ${r[lv]}`),
  }));
}

export function parseArtsGained(cell: string): { arts: string[]; anyArts: number } {
  const counts: Record<string, number> = { one: 1, two: 2, three: 3 };
  let anyArts = 0;
  const arts: string[] = [];
  for (const raw of cell.split(/,\s*(?:and\s+)?|\s+and\s+/)) {
    const t = raw.trim();
    if (t === '') continue;
    const any = /^Any (\w+)$/i.exec(t);
    const n = any?.[1] ? counts[any[1].toLowerCase()] : undefined;
    if (any && n === undefined) throw new Error(`bad arts count "${t}"`);
    if (n !== undefined) anyArts += n;
    else arts.push(slug(t));
  }
  return { arts, anyArts };
}

/** The dual-caster table (4.3.0) has no arts column; its arts come from both partial classes. */
function castingLevels(table: Table, where: string, hasArts = true): CastingProgression['levels'] {
  const [lv, max, cast, prep] = [
    /^Level$/,
    /^Max Level$/,
    /^Spells Cast$/,
    /^Spells Prepared$/,
  ].map((r) => col(table, r, where)) as [number, number, number, number];
  const arts = hasArts ? col(table, /^Arts Gained$/, where) : -1;
  return table.rows.map((r) => ({
    level: parseInt10(r[lv] ?? ''),
    maxSpellLevel: parseInt10(r[max] ?? ''),
    spellsCast: parseInt10(r[cast] ?? ''),
    spellsPrepared: parseInt10(r[prep] ?? ''),
    ...(hasArts ? parseArtsGained(r[arts] ?? '') : { arts: [], anyArts: 0 }),
  }));
}

const DUAL = '4.0 Magic and Spellcasting/4.3.0 Dual Partial Spellcasters.md';

/** SRD 4.3.0: spells cast and prepared for an Adventurer with two partial spellcasting classes. */
export function extractDualCasting(reader: SrdReader): CastingProgression {
  const doc = reader.doc(DUAL);
  const heading = findHeading(doc, 'PCs with Dual Spellcasting Traditions');
  const [table] = parseTables(sectionLines(doc, heading));
  if (!table) throw new Error(`${doc.file}: no dual spellcasting table`);
  return {
    id: 'dual-partial-spellcasters',
    name: 'Dual Partial Spellcasters',
    sources: [{ file: doc.file, heading: heading.text }],
    levels: castingLevels(table, `${doc.file}: ${heading.text}`, false),
  };
}

function classFromDoc(doc: MdDoc, out: ClassExtract, seen: Map<string, string>): void {
  const top = doc.headings.find((h) => /^1\.5\.\d+ The /.test(h.text));
  if (!top) throw new Error(`${doc.file}: no class heading`);
  const name = top.text.replace(/^1\.5\.\d+ The /, '');
  const record: ClassRecord = {
    id: slug(name),
    name,
    source: { file: doc.file, heading: top.text },
    description: proseText(sectionLines(doc, top)),
    abilities: [],
  };
  for (const h of childHeadings(doc, top)) {
    const lines = sectionLines(doc, h);
    const tables = parseTables(lines);
    const source: Source = { file: doc.file, heading: h.text };
    const where = `${doc.file}: ${h.text}`;
    const table = tables[0];
    if (table && table.header.some((c) => /^Hit Dice$/.test(c))) {
      addOnce(out.progressions, seen, {
        id: progressionId(h.text),
        name: h.text,
        sources: [source],
        levels: progressionLevels(table, where),
      });
    } else if (table && table.header.some((c) => /^Spells Cast$/.test(c))) {
      addOnce(out.casting, seen, {
        id: slug(h.text),
        name: h.text,
        sources: [source],
        levels: castingLevels(table, where),
      });
    } else {
      const prose = lines.filter((l) => !/^\s*[-*]\s+\*\*/.test(l) && !/^\s{2,}\S/.test(l));
      const text = proseText(prose);
      if (text !== '') {
        const abilityName = h.text.replace(/^Class Ability:\s*/, '').replace(/^[\d.]+\s+/, '');
        record.abilities.push({ name: abilityName, text });
      }
    }
  }
  out.classes.push(record);
}

/** Adds a table, or merges its source if an identical copy exists; differing copies are an error. */
export function addOnce<T extends { id: string; sources: Source[]; levels: unknown }>(
  list: T[],
  seen: Map<string, string>,
  item: T,
): void {
  const existing = list.find((x) => x.id === item.id);
  if (!existing) {
    list.push(item);
    seen.set(item.id, JSON.stringify(item.levels));
    return;
  }
  if (seen.get(item.id) !== JSON.stringify(item.levels)) {
    const first = existing.sources[0];
    const second = item.sources[0];
    throw new Error(
      `progression ${item.id} differs between "${first?.file}" (${first?.heading}) and "${second?.file}" (${second?.heading})`,
    );
  }
  existing.sources.push(...item.sources);
}

export function extractClasses(reader: SrdReader): ClassExtract {
  const out: ClassExtract = { classes: [], progressions: [], casting: [] };
  const seen = new Map<string, string>();
  for (const file of CLASS_FILES) classFromDoc(reader.doc(file), out, seen);
  return out;
}
