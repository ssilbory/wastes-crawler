import type { Armor, Gear, Weapon, WeaponTrait } from '../../../src/data/schemas/index.ts';
import { findHeading, parseTables, sectionLines, slug, type Table } from '../markdown.ts';
import { parseAttributes, parseCost, parseDice, parseInt10 } from '../parse-values.ts';
import type { SrdReader } from '../reader.ts';

const WEAPONS = '3.0 Equipment, Armor, and Weapons/3.5.0 Weapons.md';
const ARMOR = '3.0 Equipment, Armor, and Weapons/3.4.0 Armor.md';
const GEAR = '3.0 Equipment, Armor, and Weapons/3.2.0 Adventuring Gear.md';

function onlyTable(tables: Table[], firstHeader: string, file: string): Table {
  const matches = tables.filter((t) => t.header[0] === firstHeader);
  if (matches.length !== 1 || !matches[0]) {
    throw new Error(`${file}: expected one "${firstHeader}" table, found ${matches.length}`);
  }
  return matches[0];
}

function cells(row: string[], count: number, where: string): string[] {
  if (row.length !== count) throw new Error(`${where}: expected ${count} cells, got ${row.length}`);
  return row;
}

export function extractWeaponTraits(reader: SrdReader): WeaponTrait[] {
  const doc = reader.doc(WEAPONS);
  const heading = findHeading(doc, /Weapon Traits$/);
  const traits: WeaponTrait[] = [];
  for (const line of sectionLines(doc, heading)) {
    const m = /^\*\*([0-9A-Z]{1,3})\*\*:\s*(.+?)\.?\s*$/.exec(line);
    if (m?.[1] && m[2]) {
      traits.push({
        id: slug(m[2]),
        name: m[2],
        source: { file: doc.file, heading: heading.text },
        code: m[1],
        text: '',
      });
    } else if (line.trim() !== '' && traits.length > 0) {
      const last = traits.at(-1);
      if (last) last.text = `${last.text} ${line.trim()}`.trim();
    }
  }
  return traits;
}

export function extractWeapons(reader: SrdReader, traits: WeaponTrait[]): Weapon[] {
  const doc = reader.doc(WEAPONS);
  const heading = findHeading(doc, /Types of Weapons$/);
  const table = onlyTable(parseTables(sectionLines(doc, heading)), 'Weapon', doc.file);
  const byCode = new Map(traits.map((t) => [t.code, t.id]));
  return table.rows.map((row) => {
    const [name, dmg, shock, attr, range, traitCodes, cost, enc] = cells(row, 8, doc.file);
    const where = `${doc.file}: ${name}`;
    const shockMatch = /^(\d+)\/AC (\d+)$/.exec(shock ?? '');
    const rangeMatch = /^([\d,]+)\/([\d,]+)$/.exec(range ?? '');
    const damageAddsSkill = /\+Skill$/.test(dmg ?? '');
    return {
      id: slug(name ?? ''),
      name: name ?? '',
      source: { file: doc.file, heading: heading.text },
      damage: parseDice((dmg ?? '').replace(/\+Skill$/, '')),
      damageAddsSkill,
      shock:
        shock === 'None'
          ? null
          : shockMatch?.[1] && shockMatch[2]
            ? { damage: Number(shockMatch[1]), maxAc: Number(shockMatch[2]) }
            : (() => {
                throw new Error(`${where}: bad Shock "${shock}"`);
              })(),
      attributes: parseAttributes(attr ?? ''),
      range:
        range === '-'
          ? null
          : rangeMatch?.[1] && rangeMatch[2]
            ? {
                short: Number(rangeMatch[1].replace(/,/g, '')),
                long: Number(rangeMatch[2].replace(/,/g, '')),
              }
            : (() => {
                throw new Error(`${where}: bad range "${range}"`);
              })(),
      traits: (traitCodes ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c !== '')
        .map((c) => {
          const id = byCode.get(c);
          if (!id) throw new Error(`${where}: unknown trait "${c}"`);
          return id;
        }),
      cost: parseCost(cost ?? ''),
      encumbrance: enc === '-' ? null : parseInt10(enc ?? ''),
    };
  });
}

const ARMOR_TABLES: Record<string, Armor['category']> = {
  'Light Armors': 'light',
  'Medium Armors': 'medium',
  'Heavy Armors': 'heavy',
  Shield: 'shield',
};

export function extractArmor(reader: SrdReader): Armor[] {
  const doc = reader.doc(ARMOR);
  const heading = findHeading(doc, 'Armor');
  const tables = parseTables(sectionLines(doc, heading));
  return Object.entries(ARMOR_TABLES).flatMap(([first, category]) =>
    onlyTable(tables, first, doc.file).rows.map((row) => {
      const [name, ac, cost, enc] = cells(row, 4, doc.file);
      return {
        id: slug(name ?? ''),
        name: name ?? '',
        source: { file: doc.file, heading: heading.text },
        category,
        ac: parseInt10(ac ?? ''),
        cost: parseCost(cost ?? ''),
        encumbrance: enc === 'N/A' ? null : parseInt10(enc ?? ''),
      };
    }),
  );
}

export function extractGear(reader: SrdReader): Gear[] {
  const doc = reader.doc(GEAR);
  const heading = findHeading(doc, 'Adventuring Gear');
  const table = onlyTable(parseTables(sectionLines(doc, heading)), 'Item', doc.file);
  return table.rows.map((row) => {
    const [name, cost, enc] = cells(row, 3, doc.file);
    const raw = enc ?? '';
    const parsedCost = parseCost(cost ?? '');
    if (!parsedCost) throw new Error(`${doc.file}: ${name} has no cost`);
    const number = /^(\d+)/.exec(raw)?.[1];
    if (!number && raw !== '*' && raw !== 'N/A') {
      throw new Error(`${doc.file}: ${name} has bad encumbrance "${raw}"`);
    }
    return {
      id: slug(name ?? ''),
      name: name ?? '',
      source: { file: doc.file, heading: heading.text },
      cost: parsedCost,
      encumbrance: number ? Number(number) : null,
      weightless: raw === '*',
      freeWhenWorn: raw.endsWith('§'),
      bundlesOfThree: raw.endsWith('#'),
    };
  });
}
